import { VersionedTransaction, Connection, Keypair, TransactionMessage, Transaction, SystemProgram, sendAndConfirmTransaction, PublicKey, AddressLookupTableProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import bs58 from "bs58";
import fs from "fs";
import axios from 'axios';
import prompt from 'prompt-sync';
import dotenv from "dotenv"
import { connect } from 'http2';
dotenv.config()

const connection = new Connection(
    process.env.RPC_ENDPOINT,
    'confirmed',
);

let tokenCreateArgs = [];
const jitoTipAccounts = [
    new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
    new PublicKey("HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe"),
    new PublicKey("Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY"),
    new PublicKey("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49"),
    new PublicKey("DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"),
    new PublicKey("ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt"),
    new PublicKey("DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL"),
    new PublicKey("3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"),
    // Add more Jito tip payment accounts as needed
];

const signerKeyPair = Keypair.fromSecretKey(bs58.decode(process.env.WPK));

function walletCreate(num = 20) {

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // Months are zero-indexed, so add 1
    const date = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const fileName = 'wallets/' + `${year}-${month}-${date}-${hour}-${minute}-${second}.txt`;

    for (let i = 0; i < num; i++) {
        const wallet = Keypair.generate();
        const wallet_prv = bs58.encode(wallet.secretKey);
        const wallet_pub = wallet.publicKey;

        fs.appendFileSync(fileName, wallet_pub + " , " + wallet_prv + "\n");
    }
    console.log(`${num} wallets generated. check ${fileName}`);
    return fileName;
}

async function spiltSol(fileName, isSame, maxBuyAmount, minBuyAmount) {

    const tipAccontNumber = Math.floor((8 * Math.random()));
    const tipAmount = 300000; // 1,000 lamports is minimum, 100000 is min for working
    const balance = await connection.getBalance(signerKeyPair.publicKey);

    // console.log('log->balance', signerKeyPair.publicKey.toBase58(), balance)
    const tipInst = SystemProgram.transfer({
        fromPubkey: signerKeyPair.publicKey,
        toPubkey: jitoTipAccounts[tipAccontNumber],
        lamports: tipAmount
    });

    const fileContent = (fs.readFileSync(`wallets/${fileName}`)).toString();
    if (fileContent == "") {
        console.log("There aren't wallet addresses.");
        process.exit(1);
    }
    const wallets_ = fileContent.split('\n');
    const wallets = []
    wallets_.forEach(x => {
        if (x != "") {
            const pKey = x.split(' , ')[1].toString();
            wallets.push(Keypair.fromSecretKey(bs58.decode(pKey)))
        }
    });

    let solTransferInsts = [tipInst]
    const bundle = []
    let i = 0;
    for (let x = 0; x < wallets.length; x++) {
        i++;

        const amount = isSame ? Math.floor(maxBuyAmount * LAMPORTS_PER_SOL) : Math.floor((Math.random() * (maxBuyAmount - minBuyAmount) + minBuyAmount) * LAMPORTS_PER_SOL);
        const solTransferInst = SystemProgram.transfer({
            fromPubkey: signerKeyPair.publicKey,
            toPubkey: wallets[x].publicKey,
            lamports: amount
        });
        solTransferInsts.push(solTransferInst);
        if (i == 20 || x == wallets.length - 1) {
            const latestBlockhash = await connection.getLatestBlockhash("finalized");
            const messageMain = new TransactionMessage({
                payerKey: signerKeyPair.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: solTransferInsts,
            }).compileToV0Message();
            const txMain = new VersionedTransaction(messageMain);
            txMain.sign([signerKeyPair]);
            // console.log('Bulk sol transfer size::', txMain.serialize().length)
            const signedSwapTxn = bs58.encode(txMain.serialize());
            bundle.push(signedSwapTxn);
            if (bundle.length == 5) {
                break;
            }
            solTransferInsts = [];
            i = 0;
        }
    }
    submitBundle(bundle)
}

async function gatherSol(fileName, toAddress) {
    const tipAccontNumber = Math.floor((8 * Math.random()));
    const tipAmount = 200000; // 1,000 lamports is minimum

    const tipInst = SystemProgram.transfer({
        fromPubkey: signerKeyPair.publicKey,
        toPubkey: jitoTipAccounts[tipAccontNumber],
        lamports: tipAmount
    });

    const fileContent = (fs.readFileSync(`wallets/${fileName}`)).toString();
    if (fileContent == "") {
        console.log("There aren't wallet addresses.");
        process.exit(1);
    }
    const wallets_ = fileContent.split('\n');
    const wallets = []
    wallets_.forEach(x => {
        if (x != "") {
            const pKey = x.split(' , ')[1].toString();
            wallets.push(Keypair.fromSecretKey(bs58.decode(pKey)))
        }
    });

    let solTransferInsts = [tipInst]
    let signers = [signerKeyPair]
    const bundle = []
    let i = 0;
    for (let x = 0; x < wallets.length; x++) {
        const balance = await connection.getBalance(wallets[x].publicKey);
        // console.log('log->balance', balance)
        if (balance == 0) {
            continue;
        }
        const solTransferInst = SystemProgram.transfer({
            fromPubkey: wallets[x].publicKey,
            toPubkey: toAddress ? new PublicKey(toAddress) : signerKeyPair.publicKey,
            lamports: balance
        });
        solTransferInsts.push(solTransferInst);
        signers.push(wallets[x]);
        i++;
        if (i == 8 || x == wallets.length - 1) {
            const latestBlockhash = await connection.getLatestBlockhash("finalized");
            const messageMain = new TransactionMessage({
                payerKey: signerKeyPair.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: solTransferInsts,
            }).compileToV0Message();
            const txMain = new VersionedTransaction(messageMain);
            txMain.sign(signers);
            // console.log('Bulk sol transfer size::', txMain.serialize().length)
            // return false
            const signedSwapTxn = bs58.encode(txMain.serialize());
            bundle.push(signedSwapTxn);
            if (bundle.length == 5) {
                break;
            }
            signers = [signerKeyPair];
            solTransferInsts = [];
            i = 0;
        }
    }
    submitBundle(bundle)
}

async function tokenCreateTx() {

    const mintKeypair = Keypair.generate();
    console.log('log->mintKeypair', mintKeypair.publicKey.toBase58())
    const formData = new FormData();
    formData.append("file", await fs.openAsBlob("./logo.jpg")), // Image file
        formData.append("name", process.env.NAME),
        formData.append("symbol", process.env.SYMBOL),
        formData.append("description", process.env.DESCRIPTION),
        formData.append("twitter", process.env.X),
        formData.append("telegram", process.env.TG),
        formData.append("website", process.env.WEB),
        formData.append("showName", "true");

    console.log('log->formData', formData)
    // Create IPFS metadata storage
    const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData
    });

    // console.log('log->metadataResponse', metadataResponse)

    const metadataResponseJSON = await metadataResponse.json();
    // console.log('log->metadataResponseJSON', metadataResponseJSON)

    tokenCreateArgs = {
        "publicKey": signerKeyPair.publicKey.toBase58(),
        "action": "create",
        "tokenMetadata": {
            // name: 'MIZUKI',
            // symbol: 'MIZUKI',
            // uri: 'https://ipfs.io/ipfs/QmWQavxrKyLjmDcr23wk6KrRzq61X5NtGuFH5H7AwiWxfa',
            name: metadataResponseJSON.metadata.name,
            symbol: metadataResponseJSON.metadata.symbol,
            uri: metadataResponseJSON.metadataUri
        },
        "mint": mintKeypair.publicKey.toBase58(),
        "denominatedInSol": "true",
        "amount": 0.0001, // dev buy of 1 SOL
        "slippage": 10,
        "priorityFee": 0.001,
        "pool": "pump"
    }
    // Get the create transaction
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(tokenCreateArgs)
    });

    if (response.status === 200) { // successfully generated transaction
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        tx.sign([mintKeypair, signerKeyPair]);
        return { tx, mintKeypair }
    } else {
        console.log(response.statusText); // log error
        return
    }
}

async function tokenBuyTx(wallet, tokenAddress, amountToBuy) {
    const buyArg = {
        "publicKey": wallet.publicKey.toBase58(),   // Your wallet public key
        "action": "buy",                            // "buy" or "sell"
        "mint": tokenAddress,                       // contract address of the token you want to trade
        "denominatedInSol": "true",                // "true" if amount is amount of SOL, "false" if amount is number of tokens
        "amount": amountToBuy,                      // amount of SOL or tokens
        "slippage": 99,                             // percent slippage allowed
        "priorityFee": 0.001,                     // priority fee
        "pool": "pump"                              // exchange to trade on. "pump" or "raydium"
    }
    const args = [tokenCreateArgs, buyArg]
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(args)
    });

    if (response.status === 200) {
        const transactions = await response.json();
        const tx = VersionedTransaction.deserialize(new Uint8Array(bs58.decode(transactions[1])));
        return tx
    } else {
        console.log("error--->", response.statusText); // log error
        return
    }
}

async function tokenSellTx(walletPublicKey, tokenAddress, amount, isPump) {

    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "publicKey": walletPublicKey,              // Your wallet public key
            "action": "sell",                          // "buy" or "sell"
            "mint": tokenAddress,                      // contract address of the token you want to trade
            "denominatedInSol": "false",               // "true" if amount is amount of SOL, "false" if amount is number of tokens
            "amount": amount,                          // amount of SOL or tokens
            "slippage": 99,                            // percent slippage allowed
            "priorityFee": 0.00001,                    // priority fee
            "pool": isPump ? "pump" : "raydium"        // exchange to trade on. "pump" or "raydium"
        })
    });

    if (response.status === 200) {
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        return tx
    } else {
        console.log("error--->", response.statusText); // log error
        return
    }
}

async function createALT(addresses) {

    const tipAccontNumber = Math.floor((8 * Math.random()))
    const tipAmount = 300000; // 1,000 lamports (minimum required by Jito)
    const tipInst = SystemProgram.transfer({
        fromPubkey: signerKeyPair.publicKey,
        toPubkey: jitoTipAccounts[tipAccontNumber], // Use one of Jito's tip payment accounts
        lamports: tipAmount,
    });

    const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
        authority: signerKeyPair.publicKey,
        payer: signerKeyPair.publicKey,
        recentSlot: await connection.getSlot(),
    });
    // console.log("Lookup Table Address:", lookupTableAddress.toBase58());

    const createInstruction = [tipInst, lookupTableInst];
    const latestBlockhash = await connection.getLatestBlockhash("finalized");

    const createMessageV0 = new TransactionMessage({
        payerKey: signerKeyPair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: createInstruction
    }).compileToV0Message();

    const createTransaction = new VersionedTransaction(createMessageV0);
    createTransaction.sign([signerKeyPair]);
    // console.log('log->signature', bs58.encode(createTransaction.signatures[0]))
    // console.log('alt create tx length:: ', createTransaction.serialize().length)
    const LOOKUP_TABLE_ADDRESS = new PublicKey(lookupTableAddress.toBase58());

    const addAddressesInstruction1 = AddressLookupTableProgram.extendLookupTable({
        payer: signerKeyPair.publicKey,
        authority: signerKeyPair.publicKey,
        lookupTable: LOOKUP_TABLE_ADDRESS,
        addresses: addresses.slice(0, Math.floor(addresses.length / 2))
    });
    const add1MessageV0 = new TransactionMessage({
        payerKey: signerKeyPair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [addAddressesInstruction1]
    }).compileToV0Message()

    const add1Transaction = new VersionedTransaction(add1MessageV0);
    add1Transaction.sign([signerKeyPair]);
    // console.log('log->signature', bs58.encode(add1Transaction.signatures[0]))
    // console.log('1 alt add tx length:: ', add1Transaction.serialize().length)

    const addAddressesInstruction2 = AddressLookupTableProgram.extendLookupTable({
        payer: signerKeyPair.publicKey,
        authority: signerKeyPair.publicKey,
        lookupTable: LOOKUP_TABLE_ADDRESS,
        addresses: addresses.slice(Math.floor(addresses.length / 2) + 1)
    });
    const add2MessageV0 = new TransactionMessage({
        payerKey: signerKeyPair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [addAddressesInstruction2]
    }).compileToV0Message()

    const add2Transaction = new VersionedTransaction(add2MessageV0);
    add2Transaction.sign([signerKeyPair]);
    // console.log('log->signature', bs58.encode(add2Transaction.signatures[0]))
    // console.log('2 alt add tx length:: ', add2Transaction.serialize().length)

    const bundle = [
        bs58.encode(createTransaction.serialize()),
        bs58.encode(add1Transaction.serialize()),
        bs58.encode(add2Transaction.serialize())
    ]
    await submitBundle(bundle);
    await sleep(5000);
    const lookupTable = (await connection.getAddressLookupTable(LOOKUP_TABLE_ADDRESS)).value;
    if (!lookupTable) return;

    // console.log("   ✅ - Fetched lookup table:", lookupTable.key.toString());
    return lookupTable;
}

async function createAndBuyWithJito(fileName, minBuyAmount, maxBuyAmount) {
    console.log('fileName', fileName)
    const tipAccontNumber = Math.floor((8 * Math.random()));
    const tipAmount = 1000000; // 1,000 lamports is minimum, 300000 is min for working
    const tipInst = SystemProgram.transfer({
        fromPubkey: signerKeyPair.publicKey,
        toPubkey: jitoTipAccounts[tipAccontNumber],
        lamports: tipAmount
    });
    const { tx: createTx, mintKeypair } = await tokenCreateTx();
    const decompiledCreateTx = TransactionMessage.decompile(createTx.message);
    const latestBlockhash = await connection.getLatestBlockhash('finalized');
    const instructionsMain = [tipInst, ...decompiledCreateTx.instructions];

    const messageV0 = new TransactionMessage({
        payerKey: signerKeyPair.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: instructionsMain
    }).compileToV0Message();

    const txMain = new VersionedTransaction(messageV0);
    txMain.sign([mintKeypair, signerKeyPair]);
    // console.log('Token create Tx size::', txMain.serialize().length);
    const signedCreateTxn = bs58.encode(txMain.serialize());
    const bundle = [signedCreateTxn];

    const fileContent = (fs.readFileSync(`wallets/${fileName}`)).toString();
    if (fileContent == "") {
        console.log("There aren't wallet addresses.");
        process.exit(1);
    }

    const ataKeys = [];
    const wallets_ = fileContent.split('\n');
    const wallets = []
    for await (let x of wallets_) {
        if (x != "") {
            const publicAddress = x.split(' , ')[0].toString();
            const pKey = x.split(' , ')[1].toString();
            wallets.push(Keypair.fromSecretKey(bs58.decode(pKey)))
            // console.log('log->wallets', wallets)
            const solBalance = connection.getBalance(new PublicKey(publicAddress))
            if (solBalance < Math.floor(maxBuyAmount * LAMPORTS_PER_SOL)) {
                console.log(`${publicAddress} sol balance is less than required. Send more and try again`);
                return
            }
            ataKeys.push(new PublicKey(publicAddress));
            const senderTokenAccount = await splToken.getAssociatedTokenAddress(
                mintKeypair.publicKey,
                new PublicKey(publicAddress)
            );
            ataKeys.push(senderTokenAccount);
        }
    }
    let buyInstructions = [];
    let signers = []
    let i = 0;
    let lookupTable;
    for (let x = 0; x < wallets.length; x++) {
        const amount = Math.random() * (maxBuyAmount - minBuyAmount) + minBuyAmount;
        const tx = await tokenBuyTx(wallets[x], mintKeypair.publicKey.toBase58(), amount)
        const decompiledBuyTx = TransactionMessage.decompile(tx.message);
        if (x == 0) {
            const accountKeys = [...tx.message.staticAccountKeys, ...ataKeys.slice(2)];
            lookupTable = await createALT(accountKeys);
            // console.log('log->lookupTable', lookupTable)
        }

        const buyInstruction = [...decompiledBuyTx.instructions];
        buyInstructions.push(...(buyInstruction.slice(1)));
        signers.push(wallets[x])
        i++;
        if (i == 5 || x == wallets.length - 1) {
            const latestBlockhash = await connection.getLatestBlockhash('finalized');
            const message = new TransactionMessage({
                payerKey: signers[0].publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: buyInstructions
            }).compileToV0Message([lookupTable]);

            const txMain = new VersionedTransaction(message);
            // console.log('signers', signers)
            txMain.sign(signers);
            console.log('Bulk Buy size::', txMain.serialize().length)
            // return false
            const signedSwapTxn = bs58.encode(txMain.serialize());
            // console.log('Encoded Bulk Buy size::', signedSwapTxn.length)
            bundle.push(signedSwapTxn);
            if (bundle.length == 5) {
                break;
            }
            signers = [];
            buyInstructions = [];
            i = 0;
        }
    }
    submitBundle(bundle)
}

const tradeWithApi = async (strPubKey, signer, tokenAddress, action, amount) => {
    console.log(`Staring volume bot`, action);
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "publicKey": strPubKey,                                     // Your wallet public key
            "action": action,                                           // "buy" or "sell"
            "mint": tokenAddress,                                       // contract address of the token you want to trade
            "denominatedInSol": action == "buy" ? "true" : "false",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
            "amount": action == "buy" ? amount : "100%",                // amount of SOL or tokens
            "slippage": 50,                                             // percent slippage allowed
            "priorityFee": 0.0001,                                      // priority fee
            "pool": "pump"                                              // exchange to trade on. "pump" or "raydium"
        })
    });

    if (response.status === 200) { // successfully generated transaction
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        tx.sign([signer]);
        const signature = await connection.sendTransaction(tx)
        console.log(`${action} Transaction -------->: https://solscan.io/tx/` + signature);
    } else {
        console.log(`${action} failed`, response.statusText); // log error
    }
}

const tradeVolumeUp = async (fileName, tokenAddress, option) => {
    const TX_FEE = 3000000;
    const MIN_BUY_IN_SOL = 1000000;
    const fileContent = (fs.readFileSync(`wallets/${fileName}`)).toString();
    if (fileContent == "") {
        console.log("There aren't wallet addresses.");
        process.exit(1);
    }

    // Option 1 (buy & sell with same amount)
    if (option == 1) {
        const wallets_ = fileContent.split('\n');

        // Buy Token
        for await (let x of wallets_) {
            if (x != "") {
                const strPubKey = x.split(' , ')[0].toString();
                const strPrivKey = x.split(' , ')[1].toString();
                const solBalance = await connection.getBalance(new PublicKey(strPubKey));
                const signerKeyPair = Keypair.fromSecretKey(bs58.decode(strPrivKey));
                // Buy token
                if (solBalance > TX_FEE * 2) {
                    console.log("Xth token buying::", x, solBalance);
                    await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", (solBalance - TX_FEE * 2) / LAMPORTS_PER_SOL)
                } else {
                    console.log('Insufficient SOL balance x::', x, solBalance);
                    continue;
                }
            }
        }
        console.log("Confriming buying");
        await sleep(15000);

        // Sell token
        for await (let x of wallets_) {
            console.log('debuf x::', x, x.split(' , '));
            const strPubKey = x.split(' , ')[0].toString();
            const strPrivKey = x.split(' , ')[1].toString();
            const signerKeyPair = Keypair.fromSecretKey(bs58.decode(strPrivKey));
            const tokenBalance = await getTokenBalance(new PublicKey(strPubKey), new PublicKey(tokenAddress), false);
            if (tokenBalance > 0) {
                console.log("Xth token selling::", x, tokenBalance);
                await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "sell", 0)
            } else {
                console.log("Insufficient token balance x::", x, tokenBalance);
                continue;
            }
        }
        await sleep(15000);
        console.log("Confriming selling");
    } else if (option == 2) {
        console.log("Options of Volume 2 Start");
        const wallets_ = fileContent.split('\n');
        // 2 Buys
        for await (let x of wallets_) {
            if (x != "") {
                const strPubKey = x.split(' , ')[0].toString();
                const strPrivKey = x.split(' , ')[1].toString();
                const solBalance = await connection.getBalance(new PublicKey(strPubKey));
                const signerKeyPair = Keypair.fromSecretKey(bs58.decode(strPrivKey));
                if (solBalance > TX_FEE * 3) {
                    const firstBuyAmount = Math.random() * (solBalance - TX_FEE * 3 - MIN_BUY_IN_SOL) + MIN_BUY_IN_SOL
                    const restBuyAmount = solBalance - TX_FEE * 3 - MIN_BUY_IN_SOL - firstBuyAmount;
                    // const [firstTradeResult, secondTradeResult] = await Promise.all([
                    //     tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", firstBuyAmount),
                    //     tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", restBuyAmount)
                    // ]);
                    await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", parseInt(firstBuyAmount) / LAMPORTS_PER_SOL);
                    console.log('Confirming 1 buy');
                    await sleep(15000);
                    await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", parseInt(restBuyAmount) / LAMPORTS_PER_SOL);
                } else {
                    console.log('Insufficient SOL in wallet on Buy::', solBalance)
                    continue;
                }
            }
        }
        console.log('Confirming 2 buys')
        await sleep(15000);

        // Sell Tokens
        for await (let x of wallets_) {
            if (x != "") {
                const strPubKey = x.split(' , ')[0].toString();
                const strPrivKey = x.split(' , ')[1].toString();
                const solBalance = await connection.getBalance(new PublicKey(strPubKey));
                const signerKeyPair = Keypair.fromSecretKey(bs58.decode(strPrivKey));
                // if (solBalance > TX_FEE * 3) {
                //     const firstBuyAmount = Math.random() * (solBalance - TX_FEE * 3 - MIN_BUY_IN_SOL) + MIN_BUY_IN_SOL
                //     const restBuyAmount = solBalance - TX_FEE * 3 - MIN_BUY_IN_SOL - firstBuyAmount;
                //     // await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", firstBuyAmount)
                //     // await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", restBuyAmount)
                //     const [firstTradeResult, secondTradeResult] = await Promise.all([
                //         tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", firstBuyAmount),
                //         tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "buy", restBuyAmount)
                //     ]);

                //     console.log("Both trades completed successfully");
                //     console.log("First trade result:", firstTradeResult);
                //     console.log("Second trade result:", secondTradeResult);
                // } else {
                //     console.log('Insufficient SOL in wallet on Buy::', solBalance)
                //     return;
                // }

                // Sell token
                const tokenBalance = await getTokenBalance(new PublicKey(strPubKey), new PublicKey(tokenAddress), false);
                if (tokenBalance > 0) {
                    await tradeWithApi(strPubKey, signerKeyPair, tokenAddress, "sell", 0)
                } else {
                    console.log("Insufficient token amount and Sol amount.");
                    return;
                }
            }
        }
        console.log('Confirming 2 sells')
        await sleep(15000);
        return;
    } else {
        console.log('Invalid option');
        return;
    }
    /* Test with One wallet 
    const privKey = "3oySKsw2zTuWjpE4789nKxqeALAvCV4hVbJ6qosd6tmkrJMz6ALQQigxMojpk3UfnoyBM5K8WvsjecjK2M6VQ2yz";
    const strPubKey = "Bc9ToB12pBJhSitXZattBKoRcy1ASEYoiWFgSBWhC4Uc";
    const solBalance = await connection.getBalance(new PublicKey(strPubKey));
    const signerKeyPair = Keypair.fromSecretKey(bs58.decode(privKey));
    console.log('debug sol balance::', solBalance, typeof solBalance)
    const TX_FEE = 2000000;

    if (solBalance > TX_FEE * 2) {
        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "publicKey": strPubKey,  // Your wallet public key
                "action": "buy",                 // "buy" or "sell"
                "mint": tokenAddress,         // contract address of the token you want to trade
                "denominatedInSol": "true",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
                "amount": (solBalance - TX_FEE * 2) / LAMPORTS_PER_SOL,                  // amount of SOL or tokens
                // "amount": 0.001,                  // amount of SOL or tokens
                "slippage": 50,                  // percent slippage allowed
                "priorityFee": 0.001,          // priority fee
                "pool": "pump"                   // exchange to trade on. "pump" or "raydium"
            })
        });

        if (response.status === 200) { // successfully generated transaction
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));
            tx.sign([signerKeyPair]);
            const signature = await connection.sendTransaction(tx)
            console.log("BuyTransaction-------->: https://solscan.io/tx/" + signature);
        } else {
            console.log(response.statusText); // log error
        }

    } else {
        console.log('Insufficient SOL in wallet on Buy::', solBalance)
        return;
    }
    const tokenBalance = await getTokenBalance(new PublicKey(strPubKey), new PublicKey(tokenAddress), false) 
    if(tokenBalance > 0) {
        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "publicKey": strPubKey,  // Your wallet public key
                "action": "sell",                 // "buy" or "sell"
                "mint": tokenAddress,         // contract address of the token you want to trade
                "denominatedInSol": "false",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
                "amount": "100%",                  // amount of SOL or tokens
                // "amount": 0.001,                  // amount of SOL or tokens
                "slippage": 50,                  // percent slippage allowed
                "priorityFee": 0.0001,          // priority fee
                "pool": "pump"                   // exchange to trade on. "pump" or "raydium"
            })
        });

        if (response.status === 200) { // successfully generated transaction
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));
            tx.sign([signerKeyPair]);
            const signature = await connection.sendTransaction(tx)
            console.log("Sell Transaction-------->: https://solscan.io/tx/" + signature);
        } else {
            console.log("Error while selling::", response.statusText); // log error
        }
    }
        */
}

const sell = async (fileName, tokenAddress) => {

    const tipAccontNumber = Math.floor((8 * Math.random()));
    const jitoTipAmount = 500000; // 1,000 lamports is minimum
    const tipInst = SystemProgram.transfer({
        fromPubkey: signerKeyPair.publicKey,
        toPubkey: jitoTipAccounts[tipAccontNumber],
        lamports: jitoTipAmount
    });

    const fileContent = (fs.readFileSync(`wallets/${fileName}`)).toString();
    if (fileContent == "") {
        console.log("There aren't wallet addresses.");
        process.exit(1);
    }

    const ataKeys = [];
    const wallets_ = fileContent.split('\n');
    const wallets = [];
    for await (let x of wallets_) {
        if (x != "") {
            const publicAddress = x.split(' , ')[0].toString();
            const pKey = x.split(' , ')[1].toString();
            wallets.push(Keypair.fromSecretKey(bs58.decode(pKey)))
            ataKeys.push(new PublicKey(publicAddress));
            const senderTokenAccount = await splToken.getAssociatedTokenAddress(
                new PublicKey(tokenAddress),
                new PublicKey(publicAddress)
            );
            ataKeys.push(senderTokenAccount);
        }
    }

    let sellInstructions = [tipInst];
    let signers = [signerKeyPair]
    const txns = []
    const bundle = [];
    let i = 0;
    let lookupTable;

    for (let x = 0; x < wallets.length; x++) {
        const tokenBalance = await getTokenBalance(wallets[x].publicKey, new PublicKey(tokenAddress), false)
        const tx = await tokenSellTx(wallets[x].publicKey.toBase58(), tokenAddress, tokenBalance, true)
        const decompiledSellTx = TransactionMessage.decompile(tx.message);
        // console.log('log->tx.message', tx.message.staticAccountKeys)
        if (x == 0) {
            const accountKeys = [...tx.message.staticAccountKeys, ...ataKeys.slice(2)];
            lookupTable = await createALT(accountKeys);
            // console.log('log->lookupTable', lookupTable)
        }
        // console.log('log->decompiledSellTx', x, decompiledSellTx)
        const sellInstruction = [...decompiledSellTx.instructions];
        sellInstructions.push(...(sellInstruction.slice(2)));
        signers.push(wallets[x])
        i++;

        if (i == 4 || x == wallets.length - 1) {
            const latestBlockhash = await connection.getLatestBlockhash('confirmed');
            const message = new TransactionMessage({
                payerKey: signers[0].publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: sellInstructions
            }).compileToV0Message([lookupTable]);

            const txMain = new VersionedTransaction(message);
            txMain.sign(signers);
            txns.push(bs58.encode(txMain.signatures[0]))
            // console.log('Bulk Sell size::', txMain.serialize().length)
            const signedSwapTxn = bs58.encode(txMain.serialize());
            // console.log('Encoded Bulk Buy size::', signedSwapTxn.length)
            bundle.push(signedSwapTxn);
            if (bundle.length == 5) {
                break;
            }
            signers = [];
            sellInstructions = [];
            i = 0;
        }
    }
    submitBundle(bundle)
}

const collectToken = async (fileName, tokenAddress, toAddress) => {
    const tipAccontNumber = Math.floor((8 * Math.random()));
    const tipAmount = 500000; // 1,000 lamports is minimum

    const tipInst = SystemProgram.transfer({
        fromPubkey: signerKeyPair.publicKey,
        toPubkey: jitoTipAccounts[tipAccontNumber],
        lamports: tipAmount
    });

    const receiverTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
        connection,
        signerKeyPair,
        new PublicKey(tokenAddress),
        toAddress ? new PublicKey(toAddress) : signerKeyPair.publicKey
    )

    const fileContent = (fs.readFileSync(`wallets/${fileName}`)).toString();
    if (fileContent == "") {
        console.log("There aren't wallet addresses.");
        process.exit(1);
    }
    const wallets_ = fileContent.split('\n');
    const wallets = []
    wallets_.forEach(x => {
        if (x != "") {
            const pKey = x.split(' , ')[1].toString();
            wallets.push(Keypair.fromSecretKey(bs58.decode(pKey)))
        }
    });

    let instructions = [tipInst]
    let signers = [signerKeyPair]
    const bundle = []
    let i = 0;

    for (let x = 0; x < wallets.length; x++) {
        const senderTokenAccount = await splToken.getAssociatedTokenAddress(
            new PublicKey(tokenAddress),
            wallets[x].publicKey
        );
        const tokenBalance = await getTokenBalance(wallets[x].publicKey, new PublicKey(tokenAddress), true);
        if (tokenBalance == 0) {
            continue;
        }

        const tokenTransferInst = splToken.createTransferInstruction(
            senderTokenAccount,
            receiverTokenAccount.address,
            wallets[x].publicKey,
            tokenBalance
        )
        instructions.push(tokenTransferInst);
        signers.push(wallets[x]);
        i++;
        if (i == 5 || x == wallets.length - 1) {
            const latestBlockhash = await connection.getLatestBlockhash("finalized");
            const messageMain = new TransactionMessage({
                payerKey: signerKeyPair.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: instructions,
            }).compileToV0Message();
            const txMain = new VersionedTransaction(messageMain);
            txMain.sign(signers);
            // console.log('collect tokens transfer size::', txMain.serialize().length)
            const signedSwapTxn = bs58.encode(txMain.serialize());
            bundle.push(signedSwapTxn);
            if (bundle.length == 5) {
                break;
            }
            signers = [signerKeyPair];
            instructions = [];
            i = 0;
        }
    }
    submitBundle(bundle)
}

async function submitBundle(bundle) {
    await axios.post("https://mainnet.block-engine.jito.wtf/api/v1/bundles", {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [bundle],
    }).then(async response => {
        console.log('data_id', response.data.result)
        await sleep(5000)
        await axios.post('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
            jsonrpc: "2.0",
            id: 1,
            method: "getBundleStatuses",
            params: [
                [response.data.result]
            ],
        }).then(async response => {
            console.log('log->getBundle Response', response.data)
            if (response.data.result.value[0]?.confirmation_status === 'confirmed') {
                for (let x = 0; x < response.data.result.value[0].transactions.length; x++) {
                    console.log("Txns::" + `https://solscan.io/tx/${response.data.result.value[0].transactions[x]}`);
                }
            } else {
                console.log('log->transaciton might confirmed or not, please check it on solscan \n' + `https://solscan.io/address/${signerKeyPair.publicKey.toBase58()}`)
            }
        }).catch(error => {
            console.log('Fetch Tx Error: ', error)
        })
    }).catch(error => {
        console.log('Send Tx Error: ', error.response.data)
    })
}

const getTokenBalance = async (publicKey, tokenAddress, withDecimal) => {

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: tokenAddress });
    const tokenAccountInfo = tokenAccounts && tokenAccounts.value[0] && tokenAccounts.value[0].account;
    if (tokenAccountInfo) {
        const tokenTokenAccount = tokenAccountInfo.data.parsed.info;
        const tokenBalance = tokenTokenAccount.tokenAmount.uiAmount;
        return withDecimal ? tokenBalance * 10 ** 6 : tokenBalance;
    }
    return 0;
}

async function volumeUp(fileName, tokenAddress) {

}
async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms); //s = ms*1000
    })
}

async function closeALT(lookupTableAddress) {

    // const closeInstruction = AddressLookupTableProgram.deactivateLookupTable({
    //     lookupTable: new PublicKey(lookupTableAddress),
    //     authority: signerKeyPair.publicKey
    // });


    const closeInstruction = AddressLookupTableProgram.closeLookupTable({
        lookupTable: new PublicKey(lookupTableAddress),
        authority: signerKeyPair.publicKey,
        recipient: signerKeyPair.publicKey
    });

    const transaction = new Transaction().add(closeInstruction);

    // Send the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [signerKeyPair]);
    console.log(`Transaction confirmed with signature: ${signature}`);
    // const tipAccontNumber = Math.floor((8* Math.random()))
    // const tipAmount = 100000 // 1,000 lamports (minimum required by Jito)
    // const tipInst = SystemProgram.transfer({
    //     fromPubkey: signerKeyPair.publicKey,
    //     toPubkey: jitoTipAccounts[tipAccontNumber], // Use one of Jito's tip payment accounts
    //     lamports: tipAmount,
    // });
    // const latestBlockhash = await connection.getLatestBlockhash("finalized");
    // const MessageV0 = new TransactionMessage({
    //     payerKey: signerKeyPair.publicKey,
    //     recentBlockhash: latestBlockhash.blockhash,
    //     instructions: [tipInst, closeInstruction]
    // }).compileToV0Message();

    // const transaction = new VersionedTransaction(MessageV0);
    // transaction.sign([signerKeyPair]);
    // console.log('clost alt tx length:: ', transaction.serialize().length)
    // const bundle = [bs58.encode(transaction.serialize())]
    // await submitBundle(bundle);
}
// await spiltSol(await walletCreate(20), 10000000)

async function main() {
    console.log('Bot starting...')
    try {
        console.log('Choose option:\n' +
            '[1] Generate wallets\n' +
            '[2] Spilt SOL to wallets\n' +
            '[3] Create and buy\n' +
            '[4] Sell all\n' +
            '[5] Collect Tokens\n' +
            '[6] Collect SOL\n' +
            '[7] Volume Up');
        let opt = parseInt(prompt()('Choose Number: '));
        if (opt == 1) {
            walletCreate();
        }
        if (opt == 2) {
            const fileName = prompt()("Please enter file name of wallet addresses: ");
            console.log('Are you going to send same amount to each address?\n' +
                '[Y]es\n' +
                '[N]o\n');
            const opt = prompt()("Y or N: ");
            if (opt.toLowerCase() !== 'y' && opt.toLowerCase() !== 'n') {
                console.log('Choose y or n');
                process.exit(0);
            }
            let minAmount, maxAmount, isSame;
            if (opt.toLowerCase() === 'y') {
                isSame = true;
                maxAmount = prompt()("Enter amount in SOL: ");
                minAmount = 0;
            } else if (opt.toLowerCase() === 'n') {
                minAmount = prompt()("Enter Min amount in SOL: ");
                maxAmount = prompt()("Enter Max amount in SOL: ");
            }

            await spiltSol(fileName, isSame, Number(maxAmount), Number(minAmount));
        }
        if (opt == 3) {
            if (!process.env.NAME || !process.env.SYMBOL || !process.env.DESCRIPTION || !process.env.X || !process.env.TG || !process.env.WEB) {
                console.log('Please set token name, symbol, description, social links in .env file')
                return
            }

            console.log('  Token Name: ', process.env.NAME)
            console.log('Token Symbol: ', process.env.SYMBOL)
            console.log(' Description: ', process.env.DESCRIPTION)
            console.log('           X: ', process.env.X)
            console.log('     TG link: ', process.env.TG)
            console.log('    Web link: ', process.env.WEB)

            const fileName = prompt()("Please enter file name of wallet addresses: ");
            const minAmount = prompt()("Enter Min amount in SOL: ");
            const maxAmount = prompt()("Enter Max amount in SOL: ");

            await createAndBuyWithJito(fileName, Number(minAmount), Number(maxAmount));
        }
        if (opt == 4) {
            const fileName = prompt()("Please enter file name of wallet addresses: ");
            const tokenAddress = prompt()("Please enter token address: ");

            await sell(fileName, tokenAddress);
        }
        if (opt == 5) {
            const fileName = prompt()("Please enter file name of wallet addresses: ");
            const tokenAddress = prompt()("Please enter token address: ");
            const toAddress = prompt()('Please enter address to send funds: ');

            await collectToken(fileName, tokenAddress, toAddress);
        }
        if (opt == 6) {
            const fileName = prompt()("Please enter file name of wallet addresses: ");
            const toAddress = prompt()('Please enter address to send funds: ');

            await gatherSol(fileName, toAddress);
        }
        if (opt == 7) {
            const tokenAddress = prompt()("Please enter token address: ");
            const fileName = prompt()("Please enter file name of wallet addresses: ");

            console.log('Choose an option to increase trading volume:\n' +
                '[1] Buy & Sel with Same amount \n' +
                '[2] Byt & Sell with 2 differenct amount\n'
            );
            let option = parseInt(prompt()('Choose Number: '));
            while(1) {
                await tradeVolumeUp(fileName, tokenAddress, option);
            }
        }
    } catch (error) {
        console.log(error)
    }
}

main();