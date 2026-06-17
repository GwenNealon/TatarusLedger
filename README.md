# TatarusLedger

[![Download Git](https://img.shields.io/badge/Download-Git-green?logo=git)](https://learnxinyminutes.com/git/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20%20%7C%2022%20%7C%2024-green?logo=node.js)](https://nodejs.org/)

A TypeScript and React web tool that leverages [Universalis API](https://universalis.app/) data to surface profitable crafting, gathering, and market board arbitrage opportunities for the hit MMORPG **Final Fantasy XIV**.

---

## 📖 Table of Contents

- [Features](#-features)
- [Quickstart](#-quickstart)
- [Usage](#-usage)
- [Privacy](#-privacy)
- [FAQ](#-faq)
- [Contact & Maintainers](#-contact--maintainers)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- **Market Board Analysis**: Real-time market data from the Universalis API
- **Crafting Profit Calculator**: Find items that yield the best gil return on crafting materials
- **Gathering Opportunities**: Identify high-value gathering targets
- **Cross-World Arbitrage**: Discover price discrepancies across worlds and data centers
- **Modern Tech Stack**: Built with React 19, TypeScript 6, and Vite 8
- **Fast & Responsive**: Powered by the React Compiler for automatic memoization

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

---

## 💡 Usage

### Development Commands

Run all commands from the **repository root**:

```bash
# Start development server with hot module reload
npm run dev

# Build for production (type-check + bundle)
npm run build

# Preview production build locally
npm run preview

# Run linter (ESLint)
npm run lint

# Run type checking only
npm run typecheck

# Run tests
npm run test
```

### Building for Production

To create a production-ready build:

```bash
npm run lint      # Check for code quality issues
npm run build     # Create optimized production bundle
npm run preview   # Test the production build locally
```

The build output will be in the `dist/` directory, ready for deployment.

### Market Data

TatarusLedger uses the [Universalis API](https://universalis.app/docs/index.html) to fetch market board data. No authentication is required. The app supports:

- **World, Data Center, and Region queries**: Get market data scoped to your FFXIV world, data center, or entire region
- **Multi-item batching**: Query multiple items efficiently in a single request
- **Sale history**: View recent transaction history to identify trends

### Navigating the App

*(Once the app has more features, this section will be expanded with screenshots and detailed usage instructions.)*

Currently, TatarusLedger is in early development. The interface displays a placeholder heading. Future versions will include:
- Item search and filtering
- Profit margin calculators
- Historical price charts
- Customizable alerts for market opportunities

---

## 🔒 Privacy

TatarusLedger is a **client-side only** web application. All data processing happens in your browser.

### What We Collect

**Nothing.** TatarusLedger does not:
- Collect personal information
- Use cookies or tracking
- Store your data on external servers
- Require account creation or login

### Third-Party APIs

The app fetches market data from the [Universalis API](https://universalis.app/), a community-run service that aggregates publicly available Final Fantasy XIV market board data. When you use TatarusLedger:

- Your browser makes direct requests to `universalis.app`
- Universalis may log standard request metadata (IP address, timestamps) as per their server logs
- No personal FFXIV character data or Square Enix account information is accessed or transmitted

For more information about Universalis data handling, see the [Universalis Privacy Policy](https://universalis.app/docs/index.html).

### Local Storage

TatarusLedger may use browser local storage to save your preferences (e.g., selected world, favorite items). This data **never leaves your device** and can be cleared at any time through your browser settings.

---

## ❓ FAQ

### **Q: Do I need a Final Fantasy XIV account to use TatarusLedger?**
**A:** No. TatarusLedger displays publicly available market data and does not require any FFXIV credentials or account linkage.

### **Q: Which FFXIV worlds/data centers are supported?**
**A:** All worlds and data centers covered by the Universalis API are supported. This includes North America, Europe, Japan, and Oceania regions.

### **Q: Is TatarusLedger affiliated with Square Enix?**
**A:** No. TatarusLedger is a fan-made, community project and is not affiliated with, endorsed by, or sponsored by Square Enix or Final Fantasy XIV.

### **Q: Can I use this on mobile?**
**A:** Yes! TatarusLedger is a responsive web app that works on desktop, tablet, and mobile browsers.

### **Q: How often is the market data updated?**
**A:** Market data freshness depends on the Universalis API, which is updated by community contributions. Typical update frequency is every few minutes, but may vary by world and item popularity.

### **Q: Can I contribute or report issues?**
**A:** Absolutely! See the [Contributing](#-contributing) section below.

---

## 📬 Contact & Maintainers

**Project Maintainer**: [@GwenNealon](https://github.com/GwenNealon)

- **GitHub Issues**: [Report bugs or request features](https://github.com/GwenNealon/TatarusLedger/issues)
- **Discussions**: [Join the conversation](https://github.com/GwenNealon/TatarusLedger/discussions)

For urgent security concerns, please open a private security advisory via GitHub's [Security tab](https://github.com/GwenNealon/TatarusLedger/security/advisories/new).

---

## 🤝 Contributing

Contributions are welcome! Whether it's bug fixes, new features, documentation improvements, or design suggestions, we'd love your help.

### How to Contribute

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** and commit them: `git commit -m "Add feature X"`
4. **Push to your fork**: `git push origin feature/your-feature-name`
5. **Open a Pull Request** against the `main` branch

### Development Guidelines

- Follow the existing code style (enforced by ESLint)
- Write clean, readable TypeScript
- Follow the [Rules of React](https://react.dev/reference/rules) (no manual `useMemo`/`useCallback`; the React Compiler handles it)
- Run `npm run lint && npm run build` before submitting a PR
- Update documentation if you change user-facing behavior

For more details, see the project's [Copilot Instructions](https://github.com/GwenNealon/TatarusLedger/blob/main/.github/copilot-instructions.md) (if available).

---

## 📜 License

TatarusLedger is licensed under the [GNU General Public License v3.0](LICENSE).

You are free to use, modify, and distribute this software under the terms of the GPL v3. See the [LICENSE](LICENSE) file for full details.

---

## 🎮 Final Fantasy XIV Legal Notice

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.  
FINAL FANTASY XIV © SQUARE ENIX CO., LTD.

TatarusLedger is a fan-made project and is not affiliated with, endorsed by, or sponsored by Square Enix.
