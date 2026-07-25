'use client';

import React, { useState, useEffect } from 'react';
import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

interface NotificationItem {
  id: string;
  source: 'slack' | 'jira' | 'github' | 'gmail' | 'calendar' | 'pagerduty';
  sender: string;
  title: string;
  snippet: string;
  timestamp: string;
  link: string;
  accountId: string;
  accountEmail: string | null;
  rawMetadata?: any;
  tier: 'urgent_now' | 'normal' | 'fyi_only';
  reason: string;
}

interface PrioritizerOutput {
  prioritized: NotificationItem[];
}

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
}

export default function InteractiveDashboard() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<PrioritizerOutput>();

  const isDark = theme === 'dark';

  // State management
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');
  const [activeFilter, setActiveFilter] = useState<'all' | 'urgent_now' | 'normal' | 'fyi_only'>('all');
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { sender: 'agent', text: 'Hello! I am your Priority Agent. Ask me anything about your current notifications!' }
  ]);

  // Live Backend state
  const [liveNotifications, setLiveNotifications] = useState<NotificationItem[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Connection Simulation state
  const [connectedSources, setConnectedSources] = useState<Record<string, boolean>>({
    gmail: false,
    slack: false,
    jira: false,
    github: false,
    calendar: false
  });

  // Check backend server on mount and every 4 seconds
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/health');
        if (res.ok) {
          const health = await res.ok ? await res.json() : null;
          if (health) {
            setBackendConnected(true);
            setGoogleConnected(health.googleConnected);
            setConnectedSources({
              gmail: health.googleConnected,
              calendar: health.googleConnected,
              slack: health.slackConnected,
              jira: health.jiraConnected,
              github: health.githubConnected
            });
          }
        } else {
          setBackendConnected(false);
        }
      } catch {
        setBackendConnected(false);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live notifications from the backend API
  const fetchLiveNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/notifications');
      if (res.ok) {
        const result = await res.json();
        const prioritized = result.prioritized || [];
        setLiveNotifications(prioritized);

        // Update indicator states based on which platforms have results
        const sources = prioritized.map((p: any) => p.source);
        setConnectedSources(prev => ({
          ...prev,
          slack: sources.includes('slack') || !!process.env.NEXT_PUBLIC_SLACK_CONNECTED,
          jira: sources.includes('jira') || !!process.env.NEXT_PUBLIC_JIRA_CONNECTED,
          github: sources.includes('github') || !!process.env.NEXT_PUBLIC_GITHUB_CONNECTED
        }));
      }
    } catch (err) {
      console.error('Failed to fetch live notifications from port 3000:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger fetch when backend status turns online
  useEffect(() => {
    if (backendConnected) {
      fetchLiveNotifications();
    }
  }, [backendConnected]);

  const notifications = data?.prioritized?.length ? data.prioritized : liveNotifications;

  // Filter items
  const filteredNotifications = notifications.filter(item => {
    if (activeFilter === 'all') return true;
    return item.tier === activeFilter;
  });

  // Count items
  const urgentCount = notifications.filter(item => item.tier === 'urgent_now').length;
  const normalCount = notifications.filter(item => item.tier === 'normal').length;
  const fyiCount = notifications.filter(item => item.tier === 'fyi_only').length;

  // UI Theme Styling variables
  const baseBg = isDark ? '#0b0f19' : '#f1f5f9';
  const glassPanel = isDark ? 'rgba(23, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.85)';
  const borderCol = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const activeBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'slack': return '💬';
      case 'jira': return '🎫';
      case 'github': return '🐙';
      case 'gmail': return '✉️';
      case 'calendar': return '📅';
      case 'pagerduty': return '🚨';
      default: return '🔔';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'slack': return '#4a154b';
      case 'jira': return '#0052cc';
      case 'github': return '#24292e';
      case 'gmail': return '#ea4335';
      case 'calendar': return '#4285f4';
      case 'pagerduty': return '#df0000';
      default: return '#718096';
    }
  };

  // Agent Chat Logic
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim().toLowerCase();
    const updatedHistory = [...chatHistory, { sender: 'user' as const, text: chatInput }];
    setChatInput('');

    let agentResponse = "I analyzed your current feed but didn't find specific matches. Try asking 'What's urgent?', 'Summarize Slack', or 'Show GitHub'.";

    if (userText.includes('urgent') || userText.includes('important')) {
      const urgentList = notifications.filter(n => n.tier === 'urgent_now');
      if (urgentList.length > 0) {
        agentResponse = `You have ${urgentList.length} urgent tasks requiring action: \n` + 
          urgentList.map(n => `• [${n.source.toUpperCase()}] ${n.sender} - ${n.title} (Reason: ${n.reason})`).join('\n');
      } else {
        agentResponse = "Good news! There are no urgent items right now.";
      }
    } else if (userText.includes('slack') || userText.includes('chat')) {
      const slackList = notifications.filter(n => n.source === 'slack');
      agentResponse = `Slack summary: You have ${slackList.length} updates. ` + 
        slackList.map(n => `\n• DM from ${n.sender}: "${n.snippet}"`).join('');
    } else if (userText.includes('github') || userText.includes('pr') || userText.includes('build')) {
      const ghList = notifications.filter(n => n.source === 'github');
      agentResponse = `GitHub status: You have ${ghList.length} items. \n` + 
        ghList.map(n => `• ${n.sender} - ${n.title} (${n.reason})`).join('\n');
    } else if (userText.includes('gmail') || userText.includes('email') || userText.includes('account')) {
      const workMails = notifications.filter(n => n.accountId === 'gmail_work');
      const personalMails = notifications.filter(n => n.accountId === 'gmail_personal');
      agentResponse = `Email check:\n` +
        `• Work account (jane@company.com): ${workMails.length} unread.\n` +
        `• Personal account (jane.personal@gmail.com): ${personalMails.length} unread (triaged to FYI).`;
    }

    setChatHistory([...updatedHistory, { sender: 'agent', text: agentResponse }]);
  };

  const handleToggleConnection = (source: string) => {
    setConnectedSources(prev => ({
      ...prev,
      [source]: !prev[source]
    }));
  };

  // RENDER LANDING PAGE
  if (view === 'landing') {
    return (
      <div style={{
        backgroundColor: baseBg,
        color: textColor,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '600px',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px',
        transition: 'all 0.3s ease'
      }}>
        {/* Offline Alert Banner */}
        {!backendConnected && (
          <div style={{
            backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fffbeb',
            border: `1px solid ${isDark ? 'rgba(217, 119, 6, 0.3)' : '#fef3c7'}`,
            borderRadius: '12px',
            padding: '14px 20px',
            color: isDark ? '#fbbf24' : '#b45309',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '24px',
            textAlign: 'center',
            maxWidth: '800px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
          }}>
            ⚠️ <strong>Backend Server Offline</strong>: To enable live API sync and complete Google authentication, open a new terminal window in this project folder and run:
            <code style={{ display: 'inline-block', backgroundColor: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '4px', margin: '0 6px', fontFamily: 'monospace', fontWeight: 'bold' }}>node dist/index.js</code>
            to start the live listener on port 3000.
          </div>
        )}

        {/* Landing Container */}
        <div style={{
          maxWidth: '800px',
          textAlign: 'center',
          backgroundColor: glassPanel,
          border: `1px solid ${borderCol}`,
          borderRadius: '24px',
          padding: '48px 32px',
          boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.05)',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Logo Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            padding: '8px 16px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '24px'
          }}>
            ⚡ FocusOps Notification Prioritizer
          </div>

          <h1 style={{
            fontSize: '36px',
            fontWeight: 800,
            lineHeight: 1.2,
            margin: '0 0 16px 0',
            background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Triage the Noise. Focus on what Matters.
          </h1>

          <p style={{
            fontSize: '16px',
            color: textMuted,
            lineHeight: 1.6,
            maxWidth: '600px',
            margin: '0 auto 36px auto'
          }}>
            Employees lose hours handling notifications across Slack, Jira, GitHub, Gmail, and Calendar. 
            FocusOps prioritizes your workspace context-awarely, grouping alerts by urgency so critical tasks never get buried.
          </p>

          {/* Simulated Integrations Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginBottom: '40px',
            textAlign: 'left'
          }}>
            {Object.keys(connectedSources).map(src => {
              const isGoogle = src === 'gmail' || src === 'calendar';
              const isConnected = isGoogle ? googleConnected : connectedSources[src];

              return (
                <div key={src} style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${borderCol}`,
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                    <span>{getSourceIcon(src)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{src}</span>
                  </div>
                  
                  {isGoogle ? (
                    <button
                      onClick={() => {
                        if (!googleConnected && backendConnected) {
                          window.open('http://localhost:3000/oauth/google/login', '_blank');
                        }
                      }}
                      style={{
                        backgroundColor: googleConnected 
                          ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                          : '#3b82f6',
                        color: googleConnected ? '#10b981' : 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: googleConnected ? 'default' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {googleConnected ? 'Connected ✓' : 'Connect Google'}
                    </button>
                  ) : (
                    <div style={{
                      backgroundColor: isConnected 
                        ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                      color: isConnected ? '#10b981' : textMuted,
                      textAlign: 'center',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {isConnected ? 'Sync Active ✓' : 'Mock Mode'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action button */}
          <button
            onClick={() => setView('dashboard')}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            Launch Feature Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // RENDER DASHBOARD
  return (
    <div style={{
      backgroundColor: baseBg,
      color: textColor,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      borderRadius: '16px',
      minWidth: '950px',
      maxWidth: '1300px',
      margin: '0 auto',
      boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      minHeight: '650px'
    }}>
      {/* Offline Alert Banner in Dashboard */}
      {!backendConnected && (
        <div style={{
          backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fffbeb',
          border: `1px solid ${isDark ? 'rgba(217, 119, 6, 0.3)' : '#fef3c7'}`,
          borderRadius: '12px',
          padding: '10px 16px',
          color: isDark ? '#fbbf24' : '#b45309',
          fontSize: '12px',
          fontWeight: 500,
          textAlign: 'center'
        }}>
          ⚠️ <strong>Backend Server Offline</strong>: Real-time syncing and OAuth connections are disabled. Start it by running: <code style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>node dist/index.js</code> in a new terminal.
        </div>
      )}

      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${borderCol}`,
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setView('landing')}
            style={{
              backgroundColor: 'transparent',
              color: textMuted,
              border: `1px solid ${borderCol}`,
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            ← Back to Landing
          </button>
          <div>
            <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 700 }}>Priority Workspace Dashboard</h1>
            <p style={{ fontSize: '12px', color: textMuted, margin: '2px 0 0 0' }}>Contextual triage feed</p>
          </div>
        </div>

        {/* Sync / Refresh controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {backendConnected && (
            <button
              onClick={fetchLiveNotifications}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading ? '#64748b' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: isLoading ? 'default' : 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}
            >
              {isLoading ? '🔄 Syncing...' : '🔄 Refresh Live Feed'}
            </button>
          )}

          {!data && (
            <div style={{
              fontSize: '11px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              padding: '6px 12px',
              borderRadius: '9999px',
              color: textMuted,
              fontWeight: 600
            }}>
              {backendConnected ? '🟢 Live API Sync' : '🟡 Offline Mode'}
            </div>
          )}
        </div>
      </div>

      {/* Main 3-panel workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 300px',
        gap: '20px',
        alignItems: 'stretch'
      }}>
        {/* LEFT PANEL: Filters Sidebar */}
        <div style={{
          backgroundColor: glassPanel,
          border: `1px solid ${borderCol}`,
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Priority Feeds
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <FilterTab label="All Notifications" count={notifications.length} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
              <FilterTab label="Urgent Now" count={urgentCount} color="#ef4444" active={activeFilter === 'urgent_now'} onClick={() => setActiveFilter('urgent_now')} />
              <FilterTab label="Normal Priority" count={normalCount} color="#f59e0b" active={activeFilter === 'normal'} onClick={() => setActiveFilter('normal')} />
              <FilterTab label="FYI Only" count={fyiCount} color="#10b981" active={activeFilter === 'fyi_only'} onClick={() => setActiveFilter('fyi_only')} />
            </div>
          </div>

          {/* Accounts status list */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Connected Channels
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ChannelIndicator label="Gmail System" active={connectedSources.gmail} />
              <ChannelIndicator label="Slack Teams" active={connectedSources.slack} />
              <ChannelIndicator label="Jira Board" active={connectedSources.jira} />
              <ChannelIndicator label="GitHub Code" active={connectedSources.github} />
              <ChannelIndicator label="Google Cal" active={connectedSources.calendar} />
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Triaged Feed */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: 0,
          flex: 1
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: textMuted }}>
            {activeFilter === 'all' ? 'All Triaged tasks' : activeFilter === 'urgent_now' ? '🔴 Urgent Now Tasks' : activeFilter === 'normal' ? '🟡 Normal Tasks' : '🟢 FYI Only Tasks'} ({filteredNotifications.length})
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
            overflowX: 'auto',
            height: '560px',
            maxHeight: '560px',
            paddingRight: '6px',
            paddingBottom: '10px',
            boxSizing: 'border-box'
          }}>
            {filteredNotifications.length === 0 ? (
              <div style={{
                backgroundColor: glassPanel,
                border: `1px solid ${borderCol}`,
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                color: textMuted,
                fontSize: '14px'
              }}>
                No notifications in this feed.
              </div>
            ) : (
              filteredNotifications.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    backgroundColor: glassPanel,
                    border: `1px solid ${selectedItem?.id === item.id ? '#3b82f6' : borderCol}`,
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.2s',
                    minWidth: '550px'
                  }}
                >
                  {/* Top line metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        backgroundColor: getSourceColor(item.source) + '22',
                        color: getSourceColor(item.source),
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {getSourceIcon(item.source)} {item.source}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: textMuted }}>{item.sender}</span>
                    </div>
                    {item.accountEmail && (
                      <span style={{ fontSize: '10px', color: textMuted, opacity: 0.8 }}>
                        {item.accountEmail}
                      </span>
                    )}
                  </div>

                  {/* Title & snippet */}
                  <div>
                    <h3 style={{ fontSize: '14px', margin: '0 0 4px 0', fontWeight: 700 }}>{item.title}</h3>
                    <p style={{ fontSize: '12px', color: textMuted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.snippet}
                    </p>
                  </div>

                  {/* Reason chip */}
                  <div style={{
                    fontSize: '11px',
                    color: item.tier === 'urgent_now' ? '#ef4444' : item.tier === 'normal' ? '#b45309' : '#10b981',
                    backgroundColor: item.tier === 'urgent_now' ? '#fef2f2' : item.tier === 'normal' ? '#fffbeb' : '#f0fdf4',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontWeight: 500,
                    alignSelf: 'flex-start'
                  }}>
                    💡 {item.reason}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Details Drawer & Chat Agent */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* DETAIL VIEW DRAWER */}
          <div style={{
            backgroundColor: glassPanel,
            border: `1px solid ${borderCol}`,
            borderRadius: '12px',
            padding: '16px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notification Details
            </div>
            
            {selectedItem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                {/* Source Badge */}
                <div style={{
                  backgroundColor: getSourceColor(selectedItem.source) + '15',
                  color: getSourceColor(selectedItem.source),
                  border: `1px solid ${getSourceColor(selectedItem.source)}25`,
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{getSourceIcon(selectedItem.source)}</span>
                  <span>Extracted from {selectedItem.source.toUpperCase()}</span>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: textMuted }}>Sender</div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedItem.sender}</div>

                  <div style={{ fontSize: '11px', color: textMuted }}>Subject/Title</div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{selectedItem.title}</div>

                  <div style={{ fontSize: '11px', color: textMuted }}>Snippet Preview</div>
                  <div style={{
                    fontSize: '12px',
                    color: textMuted,
                    lineHeight: '1.4',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                    padding: '8px',
                    borderRadius: '6px',
                    border: `1px solid ${borderCol}`
                  }}>
                    {selectedItem.snippet}
                  </div>

                  <div style={{ fontSize: '11px', color: textMuted }}>Prioritization Rule</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>
                    {selectedItem.reason}
                  </div>
                </div>

                <button
                  onClick={() => window.open(selectedItem.link, '_blank')}
                  style={{
                    backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                    color: textColor,
                    border: `1px solid ${borderCol}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'center',
                    marginTop: 'auto'
                  }}
                >
                  🔗 View Original Source
                </button>
              </div>
            ) : (
              <div style={{
                color: textMuted,
                fontSize: '12px',
                textAlign: 'center',
                padding: '40px 10px',
                margin: 'auto'
              }}>
                Click a notification to inspect details.
              </div>
            )}
          </div>

          {/* AGENT CHAT SIDEBAR PANEL */}
          <div style={{
            backgroundColor: glassPanel,
            border: `1px solid ${borderCol}`,
            borderRadius: '12px',
            padding: '16px',
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🤖 Focus Agent Chat
            </div>
            
            {/* Messages display */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '11px',
              paddingRight: '2px'
            }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.sender === 'user' ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  color: msg.sender === 'user' ? 'white' : textColor,
                  padding: '6px 10px',
                  borderRadius: msg.sender === 'user' ? '8px 8px 0 8px' : '8px 8px 8px 0',
                  maxWidth: '85%',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Input message form */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                placeholder="Ask prioritizer agent..."
                style={{
                  flex: 1,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'white',
                  border: `1px solid ${borderCol}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: textColor,
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSendMessage}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Sub-components
  function FilterTab({ label, count, color, active, onClick }: { label: string; count: number; color?: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          backgroundColor: active ? activeBg : 'transparent',
          color: active ? textColor : textMuted,
          border: 'none',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {color && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />}
          {label}
        </span>
        <span style={{
          fontSize: '10px',
          backgroundColor: active ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
          padding: '2px 6px',
          borderRadius: '4px'
        }}>{count}</span>
      </button>
    );
  }

  function ChannelIndicator({ label, active }: { label: string; active: boolean }) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: textMuted
      }}>
        <span>{label}</span>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: active ? '#10b981' : '#cbd5e1'
        }} />
      </div>
    );
  }
}
