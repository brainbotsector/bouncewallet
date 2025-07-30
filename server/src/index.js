import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { randomUUID } from "crypto";
import fs from "fs";

dotenv.config({ path: "./.env" });
console.log("✅ env loaded:", !!process.env.PLAID_CLIENT_ID, !!process.env.PLAID_SECRET);

// await mongoose.connect(process.env.MONGO_URI);
const ca = [await fs.promises.readFile('/etc/ssl/certs/ca-certificates.crt')];

await mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
  sslValidate: false,
  sslCA: ca,
});

// ---------- Plaid client ----------
const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: { headers: { "PLAID-API-VERSION": "2020-09-14" } },
  })
);

// ---------- Models ----------
const User = mongoose.model("User", { email: String, password: String, plaidAccess: String });
const Account = mongoose.model("Account", { userId: mongoose.Schema.Types.ObjectId, balance: Number, number: String });
const Transaction = mongoose.model("Transaction", { from: String, to: String, amount: Number, ts: { type: Date, default: Date.now } });
const CreditEvent = mongoose.model("CreditEvent", { userId: mongoose.Schema.Types.ObjectId, type: String, amount: Number, ts: { type: Date, default: Date.now } });

// ---------- Express ----------
const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// create-link-token
app.post("/api/create_link_token", async (req, res) => {
  const { email } = req.body;
  try {
    const safeId = randomUUID(); // safe, unique, non-sensitive
    const { data } = await plaidClient.linkTokenCreate({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: safeId },
      client_name: "BounceWallet",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    });
    res.json({ link_token: data.link_token });
  } catch (err) {
    console.error("❌ Plaid error:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data?.error_message || "Plaid error" });
  }
});

// exchange public_token
app.post("/api/exchange", async (req, res) => {
  const { publicToken, email } = req.body;
  try {
    const { data } = await plaidClient.itemPublicTokenExchange({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      public_token: publicToken,
    });
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ email, password: "demo" });
    user.plaidAccess = data.access_token;
    await user.save();
    await Account.findOneAndUpdate({ userId: user._id }, { userId: user._id, number: Math.random().toString().slice(2, 12) }, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Exchange error:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data?.error_message || "Exchange error" });
  }
});

// fake ACH deposit
app.post("/api/deposit", async (req, res) => {
  const { email, amount = 0 } = req.body;
  const amt = Number(amount);
  if (!email || isNaN(amt) || amt <= 0) return res.status(400).send("invalid amount");

  const user = await User.findOne({ email });
  if (!user) return res.status(404).send("user not found");

  const acc = await Account.findOne({ userId: user._id });
  acc.balance = (acc.balance || 0) + amt;
  await acc.save();
  res.json({ balance: acc.balance });
});

// p2p send
app.post("/api/send", async (req, res) => {
  const { fromEmail, toEmail, amount = 0 } = req.body;
  const amt = Number(amount);
  if (!fromEmail || !toEmail || isNaN(amt) || amt <= 0)
    return res.status(400).send("invalid amount");

  const fromUser = await User.findOne({ email: fromEmail });
  const toUser = await User.findOne({ email: toEmail });
  if (!fromUser || !toUser) return res.status(404).send("user not found");

  const fromAcc = await Account.findOne({ userId: fromUser._id });
  const toAcc = await Account.findOne({ userId: toUser._id });

  if (!fromAcc || !toAcc) return res.status(404).send("account not found");

  if (fromAcc.balance < amt) return res.status(400).send("low balance");

  fromAcc.balance = (fromAcc.balance || 0) - amt;
  toAcc.balance = (toAcc.balance || 0) + amt;

  await fromAcc.save();
  await toAcc.save();

  await Transaction.create({ from: fromEmail, to: toEmail, amount: amt });
  await CreditEvent.create({ userId: fromUser._id, type: "on_time_payment", amount: amt });

  res.json({ ok: true });
});

// balance
app.get("/api/balance/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  const acc = await Account.findOne({ userId: user._id });
  res.json({ balance: acc?.balance || 0 });
});

// credit score
app.get("/api/credit/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  const events = await CreditEvent.find({ userId: user._id });
  let score = 600;
  events.forEach((e) => {
    if (e.type === "on_time_payment") score += Math.min(e.amount / 50, 5);
  });
  res.json({ score: Math.min(850, Math.max(300, Math.round(score))) });
});

app.listen(process.env.PORT || 5000, () => console.log("Server on 5000"));
