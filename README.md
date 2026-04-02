# StrikeF - ITCGroup7

A high-fidelity 3D Web RPG experience built with Next.js and Three.js.

## 🔗 Live Demo
Check out the live project here: [strikef.vercel.app](https://strikef.vercel.app)

---

## 📝 Project Overview
StrikeF is an immersive 3D action RPG that runs entirely in the browser. It features a rich combat system, story-driven progression, and an AI-powered assistant. The project demonstrates how modern web technologies can deliver console-like gaming experiences without additional hardware or software.

## ✨ Features
- **Dynamic 3D Combat:** Unique skill kits (Q, E, R) for multiple characters.
- **Game Modes:** 
  - **Origin:** Story-driven narrative and tutorial.
  - **Mochi General Battle:** Challenging boss encounters.
  - **Mochi Soldier Surge:** Survival wave mode.
- **AI Chatbot:** OpenAI-integrated assistant for character skills and game mechanics.
- **Gacha System:** Fair and transparent character/item acquisition.
- **Secure Auth:** BCrypt-based login and session management.

## 🛠 Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-repo/itcgroup7.git
    cd itcgroup7
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    Create a `.env.local` file and add the following:
    ```env
    DATABASE_URL=your_postgresql_url
    OPENAI_API_KEY=your_openai_api_key
    NOTION_API_KEY=your_notion_key
    NOTION_DATABASE_ID=your_database_id
    ```
4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
5.  **Access:** Open [http://localhost:3000](http://localhost:3000)

## 🚧 Known Limitations
- **Performance:** High-quality 3D assets may require a dedicated GPU for optimal frame rates on some browsers.
- **Mobile Support:** Currently optimized for desktop.
- **Network Latency:** Game state synchronization depends on database response times (hosted on Neon).

## 👥 Team Contributions

| Name            | Role & Contribution |
| --------------- | ------------------- |
| **Reynaldi**    | Mentor & Technical Advisor |
| **Tan Wei Quan**| Project Leader, Gacha Logic & AI ChatBot |
| **Agracia**     | Member, UI/UX Design & Frontend Development |
| **Janice**      | Member, UI/UX Design & Frontend Development |
| **Shisa Yoshihiro**| Member, Story Development (Origin) & Backend Integration , 3D Engine & Combat Logic |



----
*Developed for ITC Frontendamentals.*
