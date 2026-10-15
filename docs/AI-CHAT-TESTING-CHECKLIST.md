# AI Chat Email Query Testing Checklist

## Overview
This checklist validates that Clara (the AI assistant) can correctly answer questions about emails in the inbox. Each test verifies the AI's response against actual emails in the database.

## Test Environment
- **Vercel Production**: https://ai-comms-agent.vercel.app
- **Custom Domain**: https://aca.ostechnologies.in
- **Login**: owner@ai-comms-agent.local / SMTSllc@4567
- **Org ID**: 0e55fa86-18f3-4784-998f-ab652c641e99
- **Gmail Account**: mohamedrilan.dev@gmail.com (eb557569-bfe6-4849-894f-19eeb553b929)
- **Agent IDs**: 1136c6ea-96f8-4708-8bb1-8ca770ada8e9 (OpenAI), 37bad2fc-992a-43a5-8122-f296e72968ca (Sarvam)

## Test Scenarios

### 1. Time-based Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 1.1 | "Show my emails from the last 1 hour" | Returns emails received in the last 60 minutes | |
| 1.2 | "Summarize my emails from the last 10 days" | Returns a summary of emails from the last 10 days | |
| 1.3 | "What did I receive today?" | Returns emails received today | |
| 1.4 | "Show emails from yesterday" | Returns emails received yesterday | |
| 1.5 | "Any new emails in the last 30 minutes?" | Returns emails from the last 30 minutes | |

### 2. Sender-based Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 2.1 | "Show me the last email from donotreply@jobalert.indeed.com" | Returns the most recent email from that sender | |
| 2.2 | "How many emails did I get from Indeed?" | Returns count + summary of Indeed emails | |
| 2.3 | "Show all emails from OpenAI" | Returns emails from noreply@email.openai.com | |
| 2.4 | "Did I receive any email from mohammedrilan.ksa@gmail.com?" | Returns the test email sent on Oct 15 | |

### 3. Subject-based Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 3.1 | "Show me emails about job opportunities" | Returns job alert emails | |
| 3.2 | "Any emails about product release notes?" | Returns Labelbox product release email | |
| 3.3 | "Show emails with 'Test' in the subject" | Returns the "Test Email" and "Test AI Comms Agent" emails | |
| 3.4 | "Find emails about image styles" | Returns the "4 new image styles to try" email from ChatGPT | |

### 4. Summary & Analysis Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 4.1 | "What needs my attention today?" | Returns important/actionable emails from today | |
| 4.2 | "Summarize my inbox" | Returns a concise summary of recent emails | |
| 4.3 | "Give me a brief of all unread emails" | Returns summary of unread emails | |
| 4.4 | "What are the main topics in my inbox?" | Returns categorized summary of email topics | |

### 5. Count & Statistics Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 5.1 | "How many emails did I receive today?" | Returns the count of today's emails | |
| 5.2 | "How many total emails are in my inbox?" | Returns total count | |
| 5.3 | "Who sends me the most emails?" | Returns top senders by count | |

### 6. Content Search Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 6.1 | "Find emails mentioning Wipro" | Returns Wipro job alert emails | |
| 6.2 | "Show me emails about Chennai" | Returns job alerts mentioning Chennai | |
| 6.3 | "Any emails about verification?" | Returns Dubizzle verification email | |

### 7. Action-oriented Queries
| # | User Query | Expected Behavior | Pass/Fail |
|---|---|---|---|
| 7.1 | "What should I reply to the test email?" | Suggests a reply to the test email | |
| 7.2 | "Which emails need a response?" | Identifies emails that may need a reply | |
| 7.3 | "Draft a reply to the test email" | Creates a draft reply | |

## Verification Method
For each test:
1. Send the query to `/api/chat/stream` with the agent ID
2. Capture the AI's response (SSE stream)
3. Query the database directly to verify the AI's claims
4. Compare AI response vs DB reality
5. Mark Pass/Fail

## Known Data for Verification
- **Total emails**: ~4276
- **Last 1 hour**: 1 email (from donotreply@jobalert.indeed.com, "Python Application Programming with Kafka")
- **Last 10 days**: 42 emails
- **Test email**: "Test Email" from mohamedrilan.ksa@gmail.com on Oct 15 21:21 UTC
- **Top sender**: alert@indeed.com (870 emails)
- **Recent subjects**: "4 new image styles to try", "Product Release Notes: Oct 13, 2026"

## Test Results
Run date: ___________
Tester: ___________

### Overall: ___ / 22 passed
