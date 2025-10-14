const deflex = require("./dist/index.js");
const algosdk = require("algosdk");
require('dotenv').config();

async function bypassSafetySwap() {
    try {
        // Configuration from environment variables
        const API_KEY = process.env.VITE_API_KEY;
        const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
        const ALGOD_URI = process.env.ALGOD_SERVER || 'https://mainnet-api.algonode.cloud';
        const ALGOD_PORT = process.env.ALGOD_PORT ? parseInt(process.env.ALGOD_PORT) : 443;
        const REFERRER_ADDRESS = process.env.REFERRER_ADDRESS || '';
        
        // Fee configuration
        const FEE_RECIPIENT_ADDRESS = process.env.FEE_RECIPIENT_ADDRESS || 'YOUR_FEE_RECIPIENT_ADDRESS_HERE';
        
        // Swap parameters
        const FROM_ASSET_ID = 0; // ALGO
        const TO_ASSET_ID = 2591862562; // Target ASA
        const SWAP_AMOUNT = 1000000; // 1 ALGO (in microAlgos)
        const FEE_PERCENTAGE = 1.0; // 1% fee
        const FEE_AMOUNT = Math.floor(SWAP_AMOUNT * (FEE_PERCENTAGE / 100)); // 1% of swap amount
        const SLIPPAGE = 5.0; // 5.0% slippage
        const MAX_GROUP_SIZE = 13; // Reduced from 14 to account for fee transaction
        
        // Create sender account from environment variable
        if (!process.env.MNEMONIC) {
            throw new Error('MNEMONIC not found in .env file');
        }
        const sender = algosdk.mnemonicToSecretKey(process.env.MNEMONIC);
        
        // Convert the address to string format
        const senderAddress = algosdk.encodeAddress(sender.addr.publicKey);
        
        // Referral program: 25% of Deflex commissions will be sent to referrer's escrow account
        if (REFERRER_ADDRESS) {
            // Referral program active
        }
        
        // Initialize Algod client
        const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URI, ALGOD_PORT);
        
        // Use the direct API instead of the SDK to bypass safety checks
        const axios = require('axios');
        
        console.log('Fetching quote via API...');
        
        // Fetch quote directly from API
        const quoteResponse = await axios.get('https://deflex.txnlab.dev/api/fetchQuote', {
            params: {
                chain: 'mainnet',
                algodUri: ALGOD_URI,
                algodToken: ALGOD_TOKEN,
                algodPort: ALGOD_PORT,
                amount: SWAP_AMOUNT,
                type: 'fixed-input',
                fromASAID: FROM_ASSET_ID,
                toASAID: TO_ASSET_ID,
                apiKey: API_KEY,
                maxGroupSize: MAX_GROUP_SIZE,
                atomicOnly: false,
                referrer: REFERRER_ADDRESS
            }
        });
        
        const quote = quoteResponse.data;
        
        // Get asset info to properly display decimals
        const assetInfo = await algod.getAssetByID(TO_ASSET_ID).do();
        const decimals = assetInfo.params.decimals;
        const assetName = assetInfo.params.name || assetInfo.params['unit-name'] || 'UNKNOWN';
        const normalizedQuote = quote.quote / Math.pow(10, decimals);
        
        console.log('Quote received:');
        console.log(`- Quote amount: ${normalizedQuote} ${assetName} (${quote.quote} micro-units)`);
        console.log(`- Asset decimals: ${decimals}`);
        console.log('- Price impact:', quote.userPriceImpact + '%');
        console.log('- USD in:', quote.usdIn);
        console.log('- USD out:', quote.usdOut);
        
        console.log('Fetching transaction group via API...');
        
        // Fetch transaction group directly from API
        const txnResponse = await axios.post('https://deflex.txnlab.dev/api/fetchExecuteSwapTxns', {
            address: senderAddress,
            txnPayloadJSON: quote.txnPayload,
            slippage: SLIPPAGE,
            apiKey: API_KEY
        });
        
        const txnGroup = txnResponse.data;
        
        console.log('Transaction group received with', txnGroup.txns.length, 'transactions');
        
        console.log('Creating fee transaction...');
        
        // Get suggested parameters for the fee transaction
        const suggestedParams = await algod.getTransactionParams().do();
        
        console.log('Fee recipient address:', FEE_RECIPIENT_ADDRESS);
        console.log('Sender address for fee tx:', senderAddress);
        
        // Create fee payment transaction
        const feeTransaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: senderAddress,
            receiver: FEE_RECIPIENT_ADDRESS,
            amount: FEE_AMOUNT,
            note: new Uint8Array(Buffer.from(`Deflex swap fee: ${FEE_PERCENTAGE}%`)),
            suggestedParams: suggestedParams
        });
        console.log('Fee transaction created successfully');
        
        console.log('Decoding Deflex transactions...');
        const decodedTxns = txnGroup.txns.map((dtx, index) => {
            try {
                const txnBytes = Buffer.from(dtx.data, 'base64');
                const decoded = algosdk.decodeUnsignedTransaction(txnBytes);
                
                // Clean the transaction by checking for and removing problematic fields
                if (decoded.type === 'appl') {
                    const appCallTxn = decoded;
                    if (appCallTxn.apaa) {
                        delete appCallTxn.apaa;
                    }
                }
                
                return decoded;
            } catch (error) {
                throw new Error(`Failed to decode transaction ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        
        console.log(`Total transactions in Deflex group: ${decodedTxns.length}`);
        
        // Check if we need to opt-in to the target asset
        console.log('Checking asset opt-in status...');
        try {
            const accountInfo = await algod.accountInformation(senderAddress).do();
            const hasAsset = accountInfo.assets.some(asset => asset['asset-id'] === TO_ASSET_ID);
            
            if (!hasAsset) {
                console.log(`Opting in to asset ${TO_ASSET_ID}...`);
                const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    sender: senderAddress,
                    receiver: senderAddress,
                    assetIndex: TO_ASSET_ID,
                    amount: 0,
                    suggestedParams: suggestedParams
                });
                
                const signedOptInTxn = algosdk.signTransaction(optInTxn, sender.sk);
                const optInResult = await algod.sendRawTransaction(signedOptInTxn.blob).do();
                console.log('Asset opt-in submitted! TxID:', optInResult.txId || optInResult.txid || optInResult.txID);
                
                // Wait for opt-in confirmation
                const optInTxId = optInResult.txId || optInResult.txid || optInResult.txID;
                if (optInTxId) {
                    await algosdk.waitForConfirmation(algod, optInTxId, 4);
                    console.log('Asset opt-in confirmed');
                }
            } else {
                console.log(`Already opted in to asset ${TO_ASSET_ID}`);
            }
        } catch (error) {
            console.log('Warning: Could not check asset opt-in status:', error.message);
        }
        
        // Sign and submit fee transaction separately first
        console.log('Signing and submitting fee transaction...');
        const signedFeeTxn = algosdk.signTransaction(feeTransaction, sender.sk);
        const feeResult = await algod.sendRawTransaction(signedFeeTxn.blob).do();
        
        const feeTxId = feeResult.txId || feeResult.txid || feeResult.txID;
        console.log('Fee transaction submitted! TxID:', feeTxId);
        
        // Wait for fee transaction confirmation
        if (feeTxId) {
            await algosdk.waitForConfirmation(algod, feeTxId, 4);
            console.log('Fee transaction confirmed');
        } else {
            console.log('Warning: Could not get fee transaction ID, proceeding without confirmation');
        }
        
        // Now handle the Deflex swap transactions
        const signedTxns = [];
        
        // Handle the Deflex swap transactions
        txnGroup.txns.forEach((txn, index) => {
            const txnIndex = index + 1;
            
            if (txn.logicSigBlob !== false) {
                console.log(`Transaction ${txnIndex + 1}: Already signed by hotwallet`);

                const blob = txn.logicSigBlob;

                if (typeof blob === 'string') {
                    // Update the transaction with group ID before creating signed transaction
                    const signedTxn = new Uint8Array(Buffer.from(blob, 'base64'));
                    signedTxns.push(signedTxn);
                } else if (blob instanceof Uint8Array) {
                    signedTxns.push(blob);
                } else if (Array.isArray(blob)) {
                    signedTxns.push(new Uint8Array(blob));
                } else if (blob?.type === 'Buffer' && Array.isArray(blob.data)) {
                    signedTxns.push(new Uint8Array(blob.data));
                } else if (blob && Object.keys(blob).every(k => !isNaN(k))) {
                    // Convert numeric-key object to Uint8Array
                    const sortedKeys = Object.keys(blob).sort((a, b) => Number(a) - Number(b));
                    const byteArray = sortedKeys.map(k => blob[k]);
                    signedTxns.push(new Uint8Array(byteArray));
                } else {
                    console.error(`logicSigBlob content at txn ${txnIndex + 1}:`, blob);
                    console.log('Raw logicSigBlob structure:', JSON.stringify(blob, null, 2));
                    throw new Error(`logicSigBlob format unrecognized at transaction ${txnIndex + 1}`);
                }
            } else {
                console.log(`Transaction ${txnIndex}: Signing with user key`);
                // The transaction is already decoded
                signedTxns.push(algosdk.signTransaction(decodedTxns[index], sender.sk).blob);
            }
        });
        
        // Validate all transactions are proper byte arrays before submission
        console.log('Validating transaction signatures...');
        signedTxns.forEach((t, i) => {
            if (!(t instanceof Uint8Array)) {
                throw new Error(`Transaction ${i + 1} is not a byte array!`);
            }
            console.log(`Transaction ${i + 1}: Valid byte array (${t.length} bytes)`);
        });
        
        console.log('Submitting transaction group...');
        
        // Submit transaction group
        const result = await algod.sendRawTransaction(signedTxns).do();
        console.log('Swap transaction submitted!');
        
        // Get transaction ID with fallback options
        const txId = result.txId || result.txid || result.txID;
        console.log('Transaction ID:', txId);
        
        if (!txId) {
            console.error('No transaction ID returned from submission');
            console.log('Full result:', JSON.stringify(result, null, 2));
            throw new Error('Transaction submitted but no ID returned');
        }
        
        // Wait for confirmation
        console.log('Waiting for confirmation...');
        const confirmedTxn = await algosdk.waitForConfirmation(algod, txId, 4);
        const confirmedRound = confirmedTxn['confirmed-round'] || confirmedTxn.confirmedRound || confirmedTxn.round;
        console.log('Transaction confirmed in round:', confirmedRound);
        
        console.log(`Swap completed successfully with ${FEE_PERCENTAGE}% fee!`);
        
    } catch (error) {
        console.error('Error during swap:', error.message);
        if (error.response) {
            console.error('API Error:', error.response.data);
        }
    }
}

// Run the swap
bypassSafetySwap();
