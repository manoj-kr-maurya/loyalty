# Points Module

The Points module is a domain wrapper for loyalty point and tier mechanics. It composes the shared `CampaignModule` and `CustomerWalletsModule` to enable reward issuance and wallet management.

## Current State
- Wrapper around `CustomerWalletsModule` and `CampaignModule`
- Provides a domain namespace for future point-specific services and controllers
