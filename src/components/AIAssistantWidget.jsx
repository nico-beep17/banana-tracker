import React, { useState, useRef, useEffect } from 'react';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { marked } from 'marked';
import './AIAssistantWidget.css';

const AIAssistantWidget = ({ arrivals, containers, farms, onClose }) => {
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
                id: c.reeferNo, brand: c.brand, totalBoxes: c.totalBoxes, status: c.timeSealed ? 'SEALED' : 'PACKING'
            }));

            const systemContext = `
You are the LAVC ERP AI Copilot, a highly intelligent assistant for a banana exporting company.
You have access to the following real-time operations data context:
- Active Export Containers: ${JSON.stringify(activeContainersObj)}
- Number of active registered growers: ${farms.length}
- Total arrivals tracked: ${arrivals.length}

Answer the user's operational questions concisely and professionally based on this context. 
Your output should be extremely crisp. Use markdown styling like bold headers, bullet lists, or tables where it makes sense to organize data. 
If they ask something beyond this context, answer logically referencing standard banana logistics protocols.
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
            <header className="ai-header">
                <div>
                    <h4>✨ LAVC Copilot</h4>
                    <span className="online-indicator">🟢 Online</span>
                </div>
                <button className="close-btn" onClick={onClose}>×</button>
            </header>

            <div className="ai-chat-history">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <div className="chat-avatar">{msg.role === 'assistant' ? '✨' : '👤'}</div>
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
                        <div className="chat-avatar">✨</div>
                        <div className="chat-content loading-dots">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="ai-input-area">
                <input
                    type="text"
                    className="input-field"
                    placeholder="Ask about active containers or arrivals..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="btn-primary" onClick={handleSend} disabled={isLoading || !inputQuery.trim()}>
                    Send
                </button>
            </div>
        </div>
    );
};

export default AIAssistantWidget;
