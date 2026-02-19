# Pending AI Model Calendar Tasks

This file tracks pending AI company model calendars to be added.
Auto-processed by cron job every hour.

## Queue

### Phase 1: High Priority (In Progress)
- [x] OpenAI - ✅ Completed (PR #3)
- [x] Anthropic - ✅ Completed (PR #2)
- [x] Google - ✅ Completed (PR #4)
- [ ] Meta (Llama 1/2/3/4, Code Llama) - 🔄 Next
- [ ] Mistral AI (Mistral 7B, Mixtral, Mistral Large)
- [ ] xAI (Grok 1/2/3)

### Phase 2: Medium Priority
- [ ] Cohere (Command, Embed, Generate)
- [ ] Stability AI (Stable Diffusion 1/2/3/XL, StableLM)
- [ ] AI21 Labs (Jurassic, Jamba)
- [ ] Microsoft (Phi series, Orca)

### Phase 3: Lower Priority
- [ ] Amazon (Titan)
- [ ] NVIDIA (Nemotron)
- [ ] Databricks (DBRX)
- [ ] Snowflake (Arctic)

## Instructions for Agent

When processing next task:
1. Read Wikipedia page for company model history
2. Verify dates from official company sources
3. Create calendar YAML file in data/ai-industry/
4. Run: npm run cli -- validate
5. Create branch, commit, push
6. Create PR with comprehensive description
7. Update this file to mark as complete
8. Report completion to user
