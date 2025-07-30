import { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import axios from "axios";
import "./App.css";

axios.defaults.baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState(0);
  const [score, setScore] = useState(600);
  const [linkToken, setLinkToken] = useState("");

  const getLinkToken = async () => {
    if (!email.trim()) return alert("Enter an email!");
    const { data } = await axios.post("/api/create_link_token", { email });
    setLinkToken(data.link_token);
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      await axios.post("/api/exchange", { publicToken, email });
      refresh();
    },
  });

  const refresh = async () => {
    const b = await axios.get(`/api/balance/${email}`);
    const s = await axios.get(`/api/credit/${email}`);
    setBalance(b.data.balance);
    setScore(s.data.score);
  };

  const deposit = async () => {
    await axios.post("/api/deposit", { email, amount: 1000 });
    refresh();
  };

  const send = async () => {
    const to = prompt("Receiver email?");
    const amt = Number(prompt("Amount?"));
    if (!to || !amt) return;
    await axios.post("/api/send", { fromEmail: email, toEmail: to, amount: amt });
    refresh();
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1>BounceWallet</h1>

        <input
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="btn-row">
          <button onClick={getLinkToken} className="btn primary">
            Get Link Token
          </button>
          {linkToken && (
            <button onClick={() => open()} disabled={!ready} className="btn success">
              Link Bank
            </button>
          )}
          <button onClick={deposit} className="btn warning">
            Deposit $1 000
          </button>
          <button onClick={send} className="btn danger">
            Send P2P
          </button>
          <button onClick={refresh} className="btn info">
            Refresh Balance
          </button>
        </div>

        <div className="stats">
          <div>
            <span className="label">Balance</span>
            <span className="value">${balance}</span>
          </div>
          <div>
            <span className="label">Credit Score</span>
            <span className="value">{score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

// import React, { useEffect, useState } from 'react';
// import { usePlaidLink } from 'react-plaid-link';
// import axios from 'axios';

// axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// function App() {
//   const [email, setEmail] = useState('');
//   const [balance, setBalance] = useState(0);
//   const [score, setScore] = useState(600);
//   const [linkToken, setLinkToken] = useState('');

//   // fetch link token
//   const getLinkToken = async () => {
//     const { data } = await axios.post('/api/create_link_token', { email });
//     setLinkToken(data.link_token);
//   };

//   // plaid hook
//   const { open, ready } = usePlaidLink({
//     token: linkToken,
//     onSuccess: async (publicToken) => {
//       await axios.post('/api/exchange', { publicToken, email });
//       refresh();
//     },
//   });

//   const refresh = async () => {
//     const b = await axios.get(`/api/balance/${email}`);
//     const s = await axios.get(`/api/credit/${email}`);
//     setBalance(b.data.balance);
//     setScore(s.data.score);
//   };

//   const deposit = async () => {
//     await axios.post('/api/deposit', { email, amount: 1000 });
//     refresh();
//   };

//   const send = async () => {
//     const to = prompt('Receiver email?');
//     const amt = Number(prompt('Amount?'));
//     if (!to || !amt) return;
//     await axios.post('/api/send', { fromEmail: email, toEmail: to, amount: amt });
//     refresh();
//   };

//   return (
//     <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-6">
//       <h1 className="text-4xl font-bold">BounceWallet</h1>
//       <input
//         className="px-3 py-2 rounded text-black"
//         placeholder="your@email.com"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//       />
//       <button onClick={getLinkToken} className="bg-blue-600 px-4 py-2 rounded">
//         Get Link Token
//       </button>
//       {linkToken && (
//         <button onClick={() => open()} disabled={!ready} className="bg-green-600 px-4 py-2 rounded">
//           Link Bank
//         </button>
//       )}
//       <button onClick={deposit} className="bg-yellow-600 px-4 py-2 rounded">
//         Deposit $1 000
//       </button>
//       <button onClick={send} className="bg-purple-600 px-4 py-2 rounded">
//         Send P2P
//       </button>
//       <button onClick={refresh} className="bg-teal-600 px-4 py-2 rounded">
//         Refresh Balance
//       </button>
//       <div className="text-2xl">Balance: ${balance}</div>
//       <div className="text-2xl">Credit Score: {score}</div>
//     </div>
//   );
// }

// export default App;