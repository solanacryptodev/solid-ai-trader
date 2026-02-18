# Langchain DeepAgent Documentation

## Documentation
- [DeepAgent Overview](https://docs.langchain.com/oss/javascript/deepagents/overview): Everything you need to know about DeepAgent. 
- [DeepAgent Customization](https://docs.langchain.com/oss/javascript/deepagents/customization): Contains valuable information on how to customize the DeepAgent. Skills, tools, memory, system prompt, middleware, subagents.
- [DeepAgent SubAgents](https://docs.langchain.com/oss/javascript/deepagents/subagents): Everything you need to know about subagents. General-purpose subagents and more.
- [DeepAgent Long-Term Memory](https://docs.langchain.com/oss/javascript/deepagents/long-term-memory): Short-term vs Long-term memory and a lot more.

## DeepAgent Architecture

High-Score Token from Watchlist
         ↓
┌────────────────────────────────┐
│   ORCHESTRATOR AGENT           │
└────────────────────────────────┘
         ↓
    Delegates to:
         ↓
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ SOCIAL AGENT │ CHART AGENT  │ MODEL AGENT  │SECURITY AGENT│EXECUTION AGENT│
│  (Twitter/X) │(Technical TA)│  (Chronos)   │(Final checks)│(Trade executor)│
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘