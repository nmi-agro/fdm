---
title: Organizations
---

Organizations provide a way to group and manage multiple farms and users under a single entity. This is particularly useful for large agricultural businesses, cooperatives, and other organizations that need to manage data from multiple farms.

## The Organization Schema

The organization-related tables are part of the `fdm-authn` schema, which is based on the `better-auth` library. The main tables are:

- **`organization`**: This table stores the basic information about an organization, including its `id`, `name`, `slug`, and `logo`.
- **`member`**: This table links users to organizations. Each row represents a user's membership in an organization and includes their `userId`, `organizationId`, and `role` within that organization (e.g., 'admin', 'member').
- **`invitation`**: This table is used to manage invitations for users to join an organization.

## Farm Groups

Organizations can organize their farms into **farm groups**, stored in the `fdm` schema (`farm_groups`, `farm_group_joining` and `farm_group_leaving`). A farm can belong to multiple groups. Groups are organizational metadata: they do not grant access to farms, access remains controlled per farm. The organization holds the `owner` role on the `farm_group` resource, so all members of the organization can use the groups.

For every farm in a group, users choose the dates from which (`b_group_joined`) and until which (`b_group_leaved`, optional) the farm is part of the group. These are the dates of the period itself, not the moment the farm was assigned to or removed from the group, so a period can lie in the past or the future. A farm can be part of a group in several periods. Pages that select the farms of a group use the farms that are part of the group today.

## Multi-Farm Access and Management

Organizations enable a powerful mechanism for managing access to farms for groups of users. Instead of granting roles to individual users for each farm, an owner of a farm can grant a role (e.g., `advisor` or `researcher`) directly to an `Organization`.

When a role is granted to an `Organization` for a specific farm, all members of that `Organization` automatically "inherit" this role for that farm. This significantly simplifies access management, especially for larger setups or when working with teams.

This capability allows you to:

- **Centralize Access Control**: Manage farm access for an entire team by granting a single role to their organization.
- **Streamline Onboarding**: New members joining an organization automatically gain the appropriate farm access without individual assignments.
- **Facilitate Multi-Farm Analysis**: Members of an organization can easily compare and view data across multiple farms to which their organization has been granted access.
- **Identify Trends and Patterns**: Analyze data and identify trends across the collective farms managed by the organization.
- **Roll Up Data**: Aggregate data to the organization level for high-level reporting and strategic decision-making.

This direct linkage of roles between organizations and farms via the `fdm-authz` schema provides a robust and efficient way to manage multi-farm operations.

## User Management

Organizations also provide a mechanism to manage users _within_ the organization. You can add users to an organization and assign them roles (e.g., `owner`, `admin`, `member`) that determine their level of administrative access and permissions within that organization itself. This, in conjunction with the organization's inherited roles on farms, collectively determines a user's overall access to data.

This simplifies user management and ensures that users only have access to the data they need.
