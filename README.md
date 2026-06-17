# Tataru's Ledger

[![Download](https://img.shields.io/badge/Download-green)](https://learnxinyminutes.com/git/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20%20%7C%2022%20%7C%2024-green?logo=node.js)](https://nodejs.org/)

A client-side web application that helps **Final Fantasy XIV** players make smarter economic decisions by analyzing real-time market board data from the [Universalis API](https://universalis.app/).

---

## 📖 Table of Contents

- [Philosophy](#-philosophy)
- [Features](#-features)
- [Quickstart](#-quickstart)
- [Usage](#-usage)
- [Contact & Maintainers](#-contact--maintainers)
- [License](#-license)

---

## ✨ Features

Tataru's Ledger is currently in early development. Planned and implemented features include:

- **Market Board Analysis**: Real-time listing and sale data from the Universalis API across all supported worlds, data centers, and regions
- **Crafting Profit Calculator**: Calculate potential profit margins by comparing crafted item sale prices against material costs
- **Gathering Opportunities**: Identify high-value gathering targets based on current market demand and pricing
- **Cross-World Arbitrage**: Discover items with significant price differences between worlds in your data center for buy-low, sell-high opportunities
- **Historical Price Tracking**: View recent sale history to understand price trends and market stability
- **Multi-Item Analysis**: Batch query multiple items efficiently to compare opportunities side-by-side
- **Customizable Filters**: Filter and sort results by profit margin, velocity, world, and other criteria

Future enhancements may include alerts for market opportunities, crafting recipe trees, and integration with additional data sources.

---

## 🚀 Quickstart

### Prerequisites

- **Node.js**: Version 20.19+, 22.12+, or 24.0+
- **npm**: Comes bundled with Node.js

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/GwenNealon/TatarusLedger.git
   cd TatarusLedger
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to the local URL displayed in the terminal (typically `http://localhost:5173`).

### Development Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run lint       # Run linter
npm run typecheck  # Type check
npm run test       # Run tests
```

---

## 💡 Usage

Tataru's Ledger is currently in early development. The interface displays a placeholder heading while core features are being implemented.

### Market Data

The application fetches real-time market board data from the [Universalis API](https://universalis.app/docs/index.html), a community-powered service that aggregates publicly available market information from Final Fantasy XIV. No authentication or FFXIV account is required to use Tataru's Ledger.

Market data coverage includes:
- All North America, Europe, Japan, and Oceania worlds
- World-specific, data center-wide, and region-wide queries
- Current listings and recent sale history
- Multi-item batch queries for efficient data retrieval

Once the application is fully developed, you'll be able to search for items, view profit opportunities, analyze price trends, and filter results by various criteria directly in the web interface.

---

## 📬 Contact & Maintainers

**Project Maintainer**: [@GwenNealon](https://github.com/GwenNealon)

- **GitHub Issues**: [Report bugs or request features](https://github.com/GwenNealon/TatarusLedger/issues)
- **Discussions**: [Join the conversation](https://github.com/GwenNealon/TatarusLedger/discussions)

For urgent security concerns, please open a private security advisory via GitHub's [Security tab](https://github.com/GwenNealon/TatarusLedger/security/advisories/new).

---

## 📜 License

Tataru's Ledger is licensed under the [GNU General Public License v3.0](LICENSE).

You are free to use, modify, and distribute this software under the terms of the GPL v3. See the [LICENSE](LICENSE) file for full details.

---

## 🎮 Final Fantasy XIV Legal Notice

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.  
FINAL FANTASY XIV © SQUARE ENIX CO., LTD.

Tataru's Ledger is a fan-made project and is not affiliated with, endorsed by, or sponsored by Square Enix.
