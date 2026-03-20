import React, { useState, useRef, useEffect } from 'react';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { marked } from 'marked';
import { Bot, X, Send, User, Sparkles } from 'lucide-react';
import './AIAssistantWidget.css';

const AIAssistantWidget = ({ arrivals = [], containers = [], farms = [], inventoryMetrics = {}, totalBoxesToday = 0, advancedAnalytics = {}, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputQuery, setInputQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Initial greeting
    useEffect(() => {
        setMessages([
            { role: 'assistant', text: 'Hello! I am your LAVC AI Copilot. How can I help you analyze our operations today?' }
        ]);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!inputQuery.trim()) return;

        const userMsg = inputQuery.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInputQuery('');
        setIsLoading(true);

        try {
            // Validate API Key presence
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("OpenAI API Key is missing. Please check .env configuration.");
            }

            // Initialize LangChain Chat OpenAI instance
            const chatModel = new ChatOpenAI({
                apiKey: apiKey,
                model: 'gpt-4o-mini', // Fast, cost-effective for generic operations
                temperature: 0.1, // Keep it factual
            });

            // Build dynamic context from current app state
            const activeContainersObj = containers.filter(c => !c.timeDeparted).map(c => ({
                id: c.reeferNo, brand: c.brand, totalBoxes: c.totalBoxes, status: c.timeSealed ? 'SEALED' : 'PACKING', destination: c.destination
            }));

            const systemContext = `
You are the LAVC ERP AI Copilot, a highly intelligent assistant for a banana exporting company.
You have access to the following real-time operations data context:
- Today's Total Arrivals (Boxes): ${totalBoxesToday}
- Active Export Containers: ${JSON.stringify(activeContainersObj)}
- Number of active registered growers: ${farms.length}
- Total arrivals tracked: ${arrivals.length}
- Inventory Status (Boxes in Hub): Total=${inventoryMetrics.total || 0}, Class A=${inventoryMetrics.classA || 0}, Class B=${inventoryMetrics.classB || 0}
- Global Downgrade Rate (Quality Control): ${advancedAnalytics.downgradeRate ? advancedAnalytics.downgradeRate.toFixed(1) : 0}%
- Top Contributing Farms Today: ${JSON.stringify(advancedAnalytics.topFarms || [])}
- Collection Efficiency (Financial Health): ${advancedAnalytics.collectionRate ? advancedAnalytics.collectionRate.toFixed(1) : 100}%

Answer the user's operational questions concisely, accurately, and professionally based on this context. 
Your output should be extremely crisp. Use markdown styling like bold headers, bullet lists, or tables where it makes sense to organize data to make it look premium. 
If they ask something beyond this context, answer logically referencing standard banana logistics protocols. Never refuse to answer merely because data is missing; supplement with professional banana industry knowledge.
            `;

            const response = await chatModel.invoke([
                new SystemMessage(systemContext),
                new HumanMessage(userMsg)
            ]);

            setMessages(prev => [...prev, { role: 'assistant', text: response.content }]);

        } catch (error) {
            console.error("AI Assistant Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Error computing response: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="ai-widget-container shadow-lg slide-up">
            <header className="ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={20} color="var(--color-primary-main)" />
                    <h4 style={{ margin: 0 }}>LAVC Copilot</h4>
                    <span className="online-indicator" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px' }}>
                        <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span> Online
                    </span>
                </div>
                <button className="close-btn" onClick={onClose} style={{ display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </header>

            <div className="ai-chat-history">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <div className="chat-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: msg.role === 'assistant' ? 'var(--color-primary-soft)' : '#f1f5f9', color: msg.role === 'assistant' ? 'var(--color-primary-main)' : 'var(--text-secondary)' }}>
                            {msg.role === 'assistant' ? <Sparkles size={16} /> : <User size={16} />}
                        </div>
                        <div className="chat-content">
                            {msg.role === 'user' ? (
                                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</p>
                            ) : (
                                <div
                                    className="markdown-body"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}
                                />
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="chat-bubble assistant">
                        <div className="chat-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-soft)', color: 'var(--color-primary-main)' }}><Sparkles size={16} /></div>
                        <div className="chat-content loading-dots">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="ai-input-area" style={{ display: 'flex', gap: '8px', padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Ask about active containers or arrivals..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    style={{ flex: 1 }}
                />
                <button 
                    className="btn-primary" 
                    onClick={handleSend} 
                    disabled={isLoading || !inputQuery.trim()}
                    style={{ padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

export default AIAssistantWidget;
