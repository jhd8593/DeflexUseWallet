# Wallet + Deflex Token Swap

A token swap application for Algorand using Pera Wallet and Deflex API.

## Setup

### 1. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_KEY=your_deflex_api_key_here
REFERRER_ADDRESS=your_algorand_address_here

VITE_VESTIGE_API_BASE=https://api.vestigelabs.org
VITE_DEFLEX_API_BASE=https://deflex.txnlab.dev/api
VITE_ALGOD_URI=https://mainnet-api.algonode.cloud
VITE_ALGOD_PORT=443
```

### 2. Configuration

**API Key (Required)**
- DM Patrick.algo on Algorand Discord for Deflex API key
- Replace `your_deflex_api_key_here` with your actual API key

**Referral Address**
- Add your Algorand address to earn 25% commission on referred swaps
- Replace `your_algorand_address_here` with your address

### 3. Installation

```bash
npm install
npm run dev
```

## Usage

Open browser and connect Pera Wallet to swap tokens.

## Security

- Never commit your `.env` file
- Test with small amounts first
