# Pending Calendar Tasks

This file tracks pending calendar data tasks to be processed.
Auto-processed by cron job every hour.

## AI Model Calendars

### Phase 1: High Priority
- [x] OpenAI - ✅ Completed (PR #3)
- [x] Anthropic - ✅ Completed (PR #2)
- [x] Google - ✅ Completed (PR #4)
- [ ] Meta (Llama 1/2/3/4, Code Llama)
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

## Future Categories (Non-AI)
- [ ] Cloud Provider Releases (AWS, Azure, GCP major services)
- [ ] Programming Language Releases (Python, JavaScript, Rust, Go)
- [ ] Framework Releases (React, Vue, Angular, Django)
- [ ] Database Releases (PostgreSQL, MySQL, MongoDB)

## Instructions for Agent

When processing next task:
1. Research topic from reliable sources
2. Verify dates from official sources
3. Create calendar YAML file in appropriate directory
4. Run: npm run cli -- validate
5. Create branch, commit, push
6. Create PR with comprehensive description
7. Update this file to mark as complete
8. Report completion to user
