import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, MessageSquare, User, Bike } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc } from "../../lib/embeddedDb";
import { db } from '../../lib/firebase';
import { ChatMessage, UserRole } from '../../types';
import { dialogVariants, overlayVariants } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface CustomerChatProps {
  orderId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  receiverId: string;
  onClose: () => void;
}

export const CustomerChat: React.FC<CustomerChatProps> = ({
  orderId,
  currentUserId,
  currentUserName,
  currentUserRole,
  receiverId,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const q = query(collection(db, 'messages'), where('order_id', '==', orderId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      // sort by created_at
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(list);
    }, (err) => console.error('Chat snapshot error:', err));

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    triggerHaptic(30);
    const msgData = {
      order_id: orderId,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      receiver_id: receiverId || 'rider_default_1',
      message: inputText.trim(),
      created_at: new Date().toISOString()
    };

    setInputText('');
    try {
      await addDoc(collection(db, 'messages'), msgData);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={overlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        onClick={() => onClose()}
      >
        <motion.div
          variants={dialogVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-md h-[550px] flex flex-col justify-between shadow-2xl border border-rose-100 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#D6001C] flex items-center justify-center text-white">
                {currentUserRole === 'customer' ? <Bike className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">
                  {currentUserRole === 'customer' ? 'Chat with Rider' : 'Chat with Customer'}
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  Live Realtime
                </span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Messages Feed */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50">
            {messages.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-500">No messages yet.</p>
                <p className="text-[11px] text-slate-400">Send a note to coordinate delivery.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-slate-400 font-medium px-1 mb-0.5">
                      {msg.sender_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-medium shadow-2xs ${
                        isMe
                          ? 'bg-[#D6001C] text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D6001C]"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!inputText.trim()}
              className="w-10 h-10 bg-[#D6001C] text-white rounded-full flex items-center justify-center hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </form>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

