# FocusOps Demo Video — Presentation & Speech Script

This document contains a structured presentation speech script designed to accompany a video walk-through or a live demo of the FocusOps platform. It details the novelty of the problem, the critical role of Model Context Protocol (MCP), and a step-by-step feature demonstration script.

---

## 🎙️ Part 1: Introduction & The Core Problem (0:00 - 0:45)

**[Visual Screen: landing page with typewriter slogan animation typing and the 5 integration cards aligned in a single row.]**

*   **Speech:**
    > "Hello everyone. Today, I am excited to show you **FocusOps** — an AI-powered notification triage hub and agentic copilot.
    > 
    > Think about the modern knowledge worker's daily routine: we are constantly context-switching between Slack messages, Jira tickets, GitHub PR reviews, Gmail, and Google Calendar events. We lose up to two hours daily just checking what needs our attention.
    > 
    > Standard notification hubs just dump all alerts in a single place. The result is pure noise. FocusOps resolves this by using context-aware AI to separate background noise from immediate, high-priority work. Let's explore how it works."

---

## 🧩 Part 2: Why Model Context Protocol (MCP)? (0:45 - 1:30)

**[Visual Screen: Switch briefly to the Agent Console showing live tool-call traces, then show the visual comparison card grid on the landing page.]**

*   **Speech:**
    > "To achieve this securely, FocusOps is built on top of Anthropic's **Model Context Protocol (MCP)**. Why is MCP a game-changer here?
    > 
    > 1. **Standardized Context Fetching:** MCP allows us to define standardized 'Tools' and 'Resources' for Gmail, Calendar, Jira, Slack, and GitHub. Our local server coordinates all these APIs concurrently using a single protocol.
    > 2. **Local Security Boundaries:** Instead of sending all your private corporate emails and chat histories directly to a cloud database, the MCP server runs locally. Your API tokens, files, and credentials stay on your machine.
    > 3. **Agentic Capability:** Our Focus Agent AI can dynamically query these MCP tools. When you ask the agent a question, it calls MCP tools to query your live calendars and messages in real time, executing local logic securely."

---

## 🖥️ Part 3: Step-by-Step Feature Walkthrough (1:30 - 4:00)

### Step 1: Consent-First Onboarding & Connections
**[Visual Action: Hover over the Connected Integrations row. Click "Connect" on Slack, check the consent box, and confirm.]**

*   **Speech:**
    > "Let’s start with privacy. In the landing page integrations row, we have all 5 channels aligned. FocusOps uses a **Consent-First architecture**.
    > 
    > If I click 'Connect' on Slack, a secure gateway popup asks for my explicit consent to parse alerts. Only when I check the box can the connection succeed. 
    > 
    > If I later choose to click 'Disconnect', the system immediately revokes access and cleanses all associated notifications from the feed. Privacy is fully user-controlled."

---

### Step 2: Unsorted Inbox vs. FocusOps Triage
**[Visual Action: Scroll down to the Before / After Comparison cards grid.]**

*   **Speech:**
    > "Further down the page, you can see our side-by-side comparison. On the left is the **Unsorted Inbox** — the raw, overwhelming stream of Slack automated logs, general news, build alerts, and Po Jiras.
    > 
    > On the right, **FocusOps Triage** takes that same stream and uses local LLM reasoning to highlight exactly what requires immediate action: like production backup alerts or Jira security tokens due today."

---

### Step 3: Priority Workspace Feed
**[Visual Action: Click the "Launch Priority Workspace" button. Show the 3-column Workspace view.]**

*   **Speech:**
    > "Let’s launch the Workspace. The left column lists our **Priority Feeds** (Urgent, Normal, FYI) alongside the **Connected Channels** status panel.
    > 
    > In the center is the main feed. If I open the **Filter popover** at the top right, I can select or deselect specific channels. If I check only Jira and Slack, the feed instantly recalibrates.
    > 
    > Notice that since I am disconnected from Slack, those alerts are automatically hidden, and the badge counts in the sidebar adjust accordingly."

---

### Step 4: Notification Explanations
**[Visual Action: Click on an Urgent notification. Point to the "Notification Explanations" card in the right column.]**

*   **Speech:**
    > "When I select a notification, the details load in the right-hand panel. Under **Agent Logic**, the Focus Agent provides a natural language explanation of *why* it categorized the item. It acts as your personal chief of staff, telling you: *'Prioritized: High critical server error: production database failure detected.'*
    > 
    > You can also see a list of related contextual threads and a one-click button to jump directly to the original source."

---

### Step 5: Focus Agent Chat & Redirection boundaries
**[Visual Action: Point to the Focus Agent Chat panel below details. Click the Maximize icon at the top right of the Chat box. It transitions to the Focus Agent full-view tab.]**

*   **Speech:**
    > "Right below the details is the **Focus Agent chat box**. If I want a full-screen workspace copilot, I can click this small expand icon button on the header to jump to the **Focus Agent** tab.
    > 
    > Here, I can manage previous chat histories on the right sidebar and use quick question shortcuts.
    > 
    > Let's test a guardrail. If I ask a completely off-topic question, like: *'What is the capital of France?'*, the agent stays strictly on task, replying: *'im your focus agent i can only help with your notifications and worksapce tasks.'* This keeps the interface focused purely on operational output."

---

## 🏁 Part 4: Conclusion & Tech Impact (4:00 - 4:30)

**[Visual Action: Open the Agent Console view to show the live execution timeline traces of simulated alerts.]**

*   **Speech:**
    > "Finally, the **Agent Console** provides developer-grade diagnostics. In a live deployment, you can watch MCP tools like `buildUserContext` or `prioritizeNotifications` run in real-time, complete with duration metrics.
    > 
    > FocusOps proves that by combining local LLM reasoning with Anthropic's Model Context Protocol, we can build secure, context-aware productivity hubs that turn notification chaos into structured progress. 
    > 
    > Thank you!"
