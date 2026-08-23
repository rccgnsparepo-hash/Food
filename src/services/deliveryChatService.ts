import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  serverTimestamp,
  limit
} from "../lib/embeddedDb";
import { db } from '../lib/firebase';
import { ConversationMessage, DeliveryConversation, UserRole } from '../types';

/**
 * Generate standardized conversation ID for an order
 */
export function getOrderConversationId(orderId: string): string {
  return `conv_${orderId.replace(/^order_/, '')}`;
}

/**
 * Get or create an active delivery conversation between Customer and Rider
 */
export async function getOrCreateDeliveryConversation(params: {
  orderId: string;
  orderNumber?: string;
  customerId: string;
  customerName: string;
  riderId: string;
  riderName: string;
  vendorId?: string;
  vendorName?: string;
}): Promise<DeliveryConversation> {
  const { orderId, orderNumber, customerId, customerName, riderId, riderName, vendorId, vendorName } = params;
  const conversationId = getOrderConversationId(orderId);
  const convRef = doc(db, 'conversations', conversationId);

  const existingSnap = await getDoc(convRef);
  if (existingSnap.exists()) {
    const data = existingSnap.data() as DeliveryConversation;
    // If rider was reassigned, update rider info
    if (data.rider_id !== riderId) {
      await updateDoc(convRef, {
        rider_id: riderId,
        rider_name: riderName,
        updated_at: new Date().toISOString()
      });
      return { ...data, rider_id: riderId, rider_name: riderName };
    }
    return data;
  }

  const now = new Date().toISOString();
  const newConversation: DeliveryConversation = {
    id: conversationId,
    order_id: orderId,
    order_number: orderNumber || orderId.slice(-6).toUpperCase(),
    customer_id: customerId,
    customer_name: customerName,
    rider_id: riderId,
    rider_name: riderName,
    vendor_id: vendorId,
    vendor_name: vendorName,
    status: 'active',
    created_at: now,
    updated_at: now,
    last_message: null,
    unread_customer_count: 0,
    unread_rider_count: 0,
    customer_presence: { online: true, last_seen: now },
    rider_presence: { online: true, last_seen: now }
  };

  await setDoc(convRef, newConversation);
  return newConversation;
}

/**
 * Archive conversation when order is completed or cancelled
 */
export async function closeDeliveryConversation(orderId: string, status: 'archived' | 'read_only' = 'read_only'): Promise<void> {
  const conversationId = getOrderConversationId(orderId);
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      status,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Send a message in a delivery conversation
 */
export async function sendDeliveryMessage(params: {
  conversationId: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'rider' | 'admin';
  receiverId: string;
  text: string;
  type?: 'text' | 'location' | 'status_update' | 'quick_reply';
  metadata?: Record<string, any>;
}): Promise<ConversationMessage> {
  const { conversationId, orderId, senderId, senderName, senderRole, receiverId, text, type = 'text', metadata } = params;
  const now = new Date().toISOString();

  const msgData: Omit<ConversationMessage, 'id'> = {
    conversation_id: conversationId,
    order_id: orderId,
    sender_id: senderId,
    sender_name: senderName,
    sender_role: senderRole,
    receiver_id: receiverId,
    text: text.trim(),
    type,
    status: 'sent',
    created_at: now,
    read_at: null,
    metadata: metadata || {}
  };

  // Add message to subcollection
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const addedDoc = await addDoc(messagesRef, msgData);

  // Update conversation parent document
  const convRef = doc(db, 'conversations', conversationId);
  const unreadField = senderRole === 'customer' ? 'unread_rider_count' : 'unread_customer_count';

  await updateDoc(convRef, {
    last_message: {
      text: text.trim(),
      sender_id: senderId,
      sender_role: senderRole,
      created_at: now
    },
    updated_at: now,
    [unreadField]: increment(1)
  });

  // Trigger server push notification if recipient is offline / in background
  try {
    fetch('/api/chat/send-message-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        orderId,
        senderName,
        senderRole,
        receiverId,
        messageText: text.trim()
      })
    }).catch(() => {});
  } catch (e) {}

  return { id: addedDoc.id, ...msgData };
}

/**
 * Mark messages in conversation as read
 */
export async function markConversationAsRead(conversationId: string, currentUserId: string, currentUserRole: 'customer' | 'rider' | 'admin'): Promise<void> {
  if (!conversationId || !currentUserId) return;

  try {
    const convRef = doc(db, 'conversations', conversationId);
    const unreadField = currentUserRole === 'customer' ? 'unread_customer_count' : 'unread_rider_count';

    await updateDoc(convRef, {
      [unreadField]: 0,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[Chat] Failed to clear unread counts:', err);
  }
}

/**
 * Update lightweight presence heartbeat (debounced on UI)
 */
export async function updateChatPresence(
  conversationId: string,
  userRole: 'customer' | 'rider',
  isOnline: boolean,
  isTyping: boolean = false
): Promise<void> {
  if (!conversationId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    const field = userRole === 'customer' ? 'customer_presence' : 'rider_presence';
    await updateDoc(convRef, {
      [field]: {
        online: isOnline,
        last_seen: new Date().toISOString(),
        typing: isTyping
      }
    });
  } catch (e) {
    // Non-blocking presence
  }
}

/**
 * Subscribe to messages in a conversation in real-time
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onUpdate: (messages: ConversationMessage[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!conversationId) return () => {};

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('created_at', 'asc'), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ConversationMessage[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as ConversationMessage);
      });
      onUpdate(msgs);
    },
    (err) => {
      console.error('[Chat] Snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to conversation metadata / presence / unread counts in real-time
 */
export function subscribeToConversation(
  conversationId: string,
  onUpdate: (conversation: DeliveryConversation | null) => void
): () => void {
  if (!conversationId) return () => {};

  const convRef = doc(db, 'conversations', conversationId);
  return onSnapshot(
    convRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate({ id: docSnap.id, ...docSnap.data() } as DeliveryConversation);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error('[Chat] Conversation listener error:', err);
    }
  );
}
