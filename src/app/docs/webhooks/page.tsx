'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ShieldCheck, Code, Zap, Copy, Check, Terminal, Globe, Lock } from 'lucide-react';
import { ZConnectLogo } from '../../../components/ZConnectLogo';

export default function WebhooksDocPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'node' | 'python' | 'php'>('node');

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const samplePayload = `{
  "event": "message_received",
  "timestamp": "2026-07-26T01:59:00.000Z",
  "projectId": "d8927de2-9a67-45ed-88af-0c0910bb09fc",
  "data": {
    "projectName": "Zorvik Tech Support",
    "conversationId": "c4d3b2a1-1234-4567-89ab-cdef01234567",
    "userName": "Alex Rivera",
    "userEmail": "alex@clientdomain.com",
    "subject": "API Integration Question",
    "category": "Technical",
    "messageText": "Hello, how do I configure HMAC headers on custom webhooks?"
  }
}`;

  const nodeCode = `const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const ZCONNECT_API_KEY = process.env.ZCONNECT_PROJECT_API_KEY; // Your Project API Key

app.post('/api/webhooks/zconnect', (req, res) => {
  const signatureHeader = req.headers['x-zconnect-signature'];
  if (!signatureHeader) {
    return res.status(401).send('Missing X-ZConnect-Signature header');
  }

  // Extract sha256 hash
  const expectedHash = crypto
    .createHmac('sha256', ZCONNECT_API_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const expectedSignature = \`sha256=\${expectedHash}\`;

  if (signatureHeader !== expectedSignature) {
    return res.status(403).send('Invalid webhook HMAC signature');
  }

  const { event, data } = req.body;
  console.log(\`Received \${event} for conversation \${data.conversationId}\`);

  // Handle event...
  res.status(200).json({ received: true });
});

app.listen(3000, () => console.log('Webhook receiver running on port 3000'));`;

  const pythonCode = `import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)
ZCONNECT_API_KEY = "your_project_api_key_here"

@app.route('/api/webhooks/zconnect', methods=['POST'])
def zconnect_webhook():
    signature_header = request.headers.get('X-ZConnect-Signature', '')
    if not signature_header:
        return jsonify({"error": "Missing signature"}), 401

    payload_bytes = request.get_data()
    computed_hash = hmac.new(
        ZCONNECT_API_KEY.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    expected_signature = f"sha256={computed_hash}"

    if not hmac.compare_digest(signature_header, expected_signature):
        return jsonify({"error": "Invalid signature"}), 403

    payload = request.get_json()
    event_type = payload.get('event')
    print(f"Verified event: {event_type}")

    return jsonify({"received": True}), 200

if __name__ == '__main__':
    app.run(port=3000)`;

  const phpCode = `<?php
$apiKey = getenv('ZCONNECT_PROJECT_API_KEY');
$signatureHeader = $_SERVER['HTTP_X_ZCONNECT_SIGNATURE'] ?? '';

$rawBody = file_get_contents('php://input');
$expectedHash = hash_hmac('sha256', $rawBody, $apiKey);
$expectedSignature = "sha256=" . $expectedHash;

if (!hash_equals($expectedSignature, $signatureHeader)) {
    http_response_code(403);
    echo json_encode(["error" => "Invalid HMAC signature"]);
    exit();
}

$data = json_decode($rawBody, true);
// Process event...
http_response_code(200);
echo json_encode(["success" => true]);
?>`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40 shrink-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <ZConnectLogo showText size={25} />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold font-mono text-primary-accent bg-primary-accent/10 border border-primary-accent/20 px-2.5 py-1 rounded-md">
              Developer Docs
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-10 overflow-y-auto">
        {/* Title */}
        <div className="space-y-2 border-b border-border pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Globe className="h-7 w-7 text-primary-accent" />
            Outgoing Webhooks Specification
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ZConnect dispatches real-time HTTPS POST notifications to your server whenever chat tickets are created, messages are received, or tickets are resolved.
          </p>
        </div>

        {/* Section 1: Event Types */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-accent" />
            Supported Webhook Events
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                event: 'chat_started',
                name: 'Ticket Created',
                desc: 'Fired when a visitor opens a new support conversation thread.',
              },
              {
                event: 'message_received',
                name: 'Message Received',
                desc: 'Fired when a customer or operator posts a new chat message.',
              },
              {
                event: 'ticket_resolved',
                name: 'Ticket Resolved',
                desc: 'Fired when an agent or customer marks a conversation thread as resolved.',
              },
            ].map((e) => (
              <div key={e.event} className="border border-border bg-card p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-mono font-bold bg-primary-accent/15 text-primary-accent px-2 py-0.5 rounded uppercase">
                  {e.event}
                </span>
                <h3 className="text-xs font-bold text-foreground">{e.name}</h3>
                <p className="text-[11px] text-muted-foreground">{e.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Sample Payload */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Code className="h-5 w-5 text-primary-accent" />
              Sample JSON Payload
            </h2>
            <button
              onClick={() => copyCode(samplePayload, 'payload')}
              className="flex items-center gap-1.5 bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              {copiedSection === 'payload' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSection === 'payload' ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre className="bg-card border border-border p-5 rounded-2xl text-xs font-mono text-primary-accent overflow-x-auto">
            <code>{samplePayload}</code>
          </pre>
        </section>

        {/* Section 3: Signature Verification */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary-accent" />
              HMAC Signature Verification (`X-ZConnect-Signature`)
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every outgoing request includes a signature header computed using HMAC-SHA256 with your ZConnect Project API Key (`tp_api_key`).
            </p>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 border-b border-border pb-3">
            {[
              { id: 'node', label: 'Node.js / Express' },
              { id: 'python', label: 'Python / Flask' },
              { id: 'php', label: 'PHP' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setActiveLang(lang.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeLang === lang.id
                    ? 'bg-primary-accent/15 border border-primary-accent/30 text-primary-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <pre className="bg-card border border-border p-5 rounded-2xl text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
            <code>{activeLang === 'node' ? nodeCode : activeLang === 'python' ? pythonCode : phpCode}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}
