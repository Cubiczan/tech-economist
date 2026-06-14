# Infracost Integration Study

## Source: infracost/infracost (12K stars)
**Apache-2.0 | Go | Cloud Cost Intelligence**

## Key Patterns for Tech Economist

### 1. Infrastructure Cost Estimation Engine

Infracost parses Terraform/CloudFormation and estimates costs per resource. Tech Economist can parse infrastructure-as-code to estimate AI workload costs — shift from "what does this EC2 instance cost?" to "what does this LLM inference pipeline cost?"

### 2. Cost-Per-Task Model

Infracost shifts from "cost per resource" to "cost per environment" with hierarchical aggregation: Resource Cost -> Environment Cost -> Team Cost -> Business Unit Cost.

Tech Economist adaptation: hierarchical cost attribution — task -> workflow -> department -> company. Maps directly to longitudinal tracking.

### 3. PR Comment Integration

Infracost posts cost estimates directly on PRs. Tech Economist can post AI cost estimates on code PRs that change model configs or prompt templates: "This PR changes gpt-4o to gpt-4o-mini: saves $12.30/mo on workflow X."

## Reference

- GitHub: https://github.com/infracost/infracost
- Docs: https://infracost.io/docs/
