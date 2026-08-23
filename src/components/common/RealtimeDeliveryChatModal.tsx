import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  X,
  Bike,
  User,
  Check,
  CheckCheck,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
  Phone,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import {
  ConversationMessage,
  DeliveryConversation,
  UserRole
} from '../../types';
import {
  getOrCreateDeliveryConversation,
  sendDeliveryMessage,
  markConversationAsRead,
  updateChatPresence,
  subscribeToConversationMessages,
  subscribeToConversation
} from '../../services/deliveryChatService';
import { triggerHaptic } from '../../utils/haptics';
import { BukkitLogo } from './BukkitLogo';

interface RealtimeDeliveryChatModalProps {
  orderId: string;
  orderNumber?: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'customer' | 'rider' | 'admin';
  recipientId: string;
  recipientName: string;
  vendorName?: string;
  isOrderDelivered?: boolean;
  onClose: () => void;
}

const CUSTOMER_QUICK_REPLIES = [
  'I am at the hostel gate 📍',
  'Please call when you arrive 📞',
  'I will send someone down',
  'Thanks! Waiting outside'
];

const RIDER_QUICK_REPLIES = [
  'Heading to pickup stand now 🍳',
  'Picked up! On my way to you 🛵',
  'I am outside your building 🏢',
  'Traffic delay, arriving in 5 mins ⏱️'
];

export const RealtimeDeliveryChatModal: React.FC<RealtimeDeliveryChatModalProps> = ({
  orderId,
  orderNumber,
  currentUserId,
  currentUserName,
  currentUserRole,
  recipientId,
  recipientName,
  vendorName,
  isOrderDelivered = false,
  onClose
}) => {
  const [conversation, setConversation] = useState<DeliveryConversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Initialize or fetch conversation
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const conv = await getOrCreateDeliveryConversation({
          orderId,
          orderNumber,
          customerId: currentUserRole === 'customer' ? currentUserId : recipientId,
          customerName: currentUserRole === 'customer' ? currentUserName : recipientName,
          riderId: currentUserRole === 'rider' ? currentUserId : recipientId,
          riderName: currentUserRole === 'rider' ? currentUserName : recipientName,
          vendorName
        });
        if (isMounted) setConversation(conv);
      } catch (err) {
        console.error('Failed to init conversation:', err);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [orderId, currentUserId, currentUserRole, recipientId]);

  // Subscribe to real-time conversation metadata
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = subscribeToConversation(conversation.id, (data) => {
      if (data) setConversation(data);
    });
    return () => unsub();
  }, [conversation?.id]);

  // Subscribe to real-time messages & mark as read
  useEffect(() => {
    if (!conversation?.id) return;

    const unsub = subscribeToConversationMessages(conversation.id, (msgs) => {
      setMessages(msgs);
      markConversationAsRead(conversation.id, currentUserId, currentUserRole);
    });

    // Update presence
    if (currentUserRole === 'customer' || currentUserRole === 'rider') {
      updateChatPresence(conversation.id, currentUserRole, true, false);
    }

    return () => {
      unsub();
      if (conversation?.id && (currentUserRole === 'customer' || currentUserRole === 'rider')) {
        updateChatPresence(conversation.id, currentUserRole, false, false);
      }
    };
  }, [conversation?.id, currentUserId, currentUserRole]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Update typing presence
    if (conversation?.id && (currentUserRole === 'customer' || currentUserRole === 'rider')) {
      updateChatPresence(conversation.id, currentUserRole, true, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (conversation?.id) {
          updateChatPresence(conversation.id, currentUserRole, true, false);
        }
      }, 1500);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !conversation?.id || isSending) return;

    triggerHaptic(25);
    setIsSending(true);
    setInputText('');

    try {
      await sendDeliveryMessage({
        conversationId: conversation.id,
        orderId,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        receiverId: recipientId,
        text
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const quickReplies = currentUserRole === 'rider' ? RIDER_QUICK_REPLIES : CUSTOMER_QUICK_REPLIES;
  const isReadOnly = conversation?.status === 'archived' || conversation?.status === 'read_only' || isOrderDelivered;

  // Determine presence of counterpart
  const otherPresence = currentUserRole === 'customer' ? conversation?.rider_presence : conversation?.customer_presence;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg h-[620px] max-h-[92vh] flex flex-col justify-between shadow-2xl overflow-hidden text-white relative"
      >
        {/* HEADER */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-[#FF5A00]/20 border border-[#FF5A00]/30 text-[#FF5A00] flex items-center justify-center font-bold">
                {currentUserRole === 'rider' ? <User className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
              </div>
              {otherPresence?.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">{recipientName || 'Delivery Partner'}</h3>
                <span className="bg-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full text-slate-300 uppercase">
                  {currentUserRole === 'rider' ? 'Customer' : 'Courier'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>Order #{orderNumber || orderId.slice(-6).toUpperCase()}</span>
                {vendorName && <span>• {vendorName}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BukkitLogo variant="icon" size="xs" />
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRESENCE & TYPING BANNER */}
        {otherPresence?.typing && (
          <div className="bg-orange-500/10 px-4 py-1 border-b border-orange-500/20 text-[11px] text-[#FF5A00] flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A00]" />
            <span>{recipientName} is typing...</span>
          </div>
        )}

        {/* MESSAGE HISTORY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Security Notice */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Encrypted Delivery Coordination</span>
            </div>
            <p className="text-[10px] text-slate-500">
              This conversation is strictly linked to Order #{orderNumber || orderId.slice(-6).toUpperCase()} and will archive upon delivery.
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-700" />
              <p className="text-xs">No messages yet. Send a note to coordinate delivery!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMine
                        ? 'bg-[#FF5A00] text-white rounded-br-xs shadow-md'
                        : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    <p className="break-words">{msg.text}</p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                        isMine ? 'text-orange-100' : 'text-slate-400'
                      }`}
                    >
                      <span>{formattedTime}</span>
                      {isMine && (
                        <span>
                          {msg.read_at ? (
                            <CheckCheck className="w-3 h-3 text-white inline" />
                          ) : (
                            <Check className="w-3 h-3 text-orange-200 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* QUICK REPLIES BAR */}
        {!isReadOnly && (
          <div className="px-3 py-2 bg-slate-950/70 border-t border-slate-800/60 overflow-x-auto flex gap-2 no-scrollbar">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(reply)}
                className="shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* FOOTER INPUT OR READ ONLY BANNER */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          {isReadOnly ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center text-xs text-slate-400">
              <span className="font-bold text-slate-300">Delivery Completed</span> • This conversation is now archived and read-only.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder={`Message ${recipientName || 'delivery partner'}...`}
                className="flex-1 bg-slate-800/90 border border-slate-700 focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] text-white text-xs sm:text-sm rounded-2xl px-4 py-3 outline-hidden transition-all placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="bg-[#FF5A00] hover:bg-[#E04F00] disabled:bg-slate-800 disabled:text-slate-600 text-white p-3 rounded-2xl transition-all cursor-pointer disabled:cursor-not-allowed shadow-md shadow-orange-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
