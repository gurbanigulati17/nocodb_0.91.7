---
title: 'NocoDB Documentation'
description: 'NocoDB Documentation'
position: 0
category: 'Welcome'
menuTitle: 'Introduction'
---

<alert type="warning">
    This documentation is only for version 0.90 onwards. If you are looking for the previous versions, please check out 
     <a href="https://docs-prev.nocodb.com/" target="_blank">here</a>. 
</alert>

## Welcome!

NocoDB is a no-code database platform that allows teams to collaborate and build applications with ease of a familiar and intuitive spreadsheet interface. This allows even non-developers or business users to become software creators.

NocoDB works by connecting to any relational database and transforming them into a smart spreadsheet interface! This allows you to build no-code applications collaboratively with teams. NocoDB currently works with MySQL, PostgreSQL, Microsoft SQL Server, SQLite, Amazon Aurora & MariaDB databases.

Also NocoDB's app store allows you to build business workflows on views with combination of Slack, Microsoft Teams, Discord, Twilio, Whatsapp, Email & any 3rd party APIs too. Plus NocoDB provides programmatic access to APIs so that you can build integrations with Zapier / Integromat and custom applications too.

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

## Features

### Rich Spreadsheet Interface

- ⚡ &nbsp;Basic Operations: Create, Read, Update and Delete on Tables, Columns, and Rows
- ⚡ &nbsp;Fields Operations: Sort, Filter, Hide / Unhide Columns
- ⚡ &nbsp;Multiple Views Types: Grid (By default), Gallery and Form View
- ⚡ &nbsp;View Permissions Types: Collaborative Views, & Locked Views 
- ⚡ &nbsp;Share Bases / Views: either Public or Private (with Password Protected)
- ⚡ &nbsp;Variant Cell Types: ID, LinkToAnotherRecord, Lookup, Rollup, SingleLineText, Attachement, Currency, Formula and etc
- ⚡ &nbsp;Access Control with Roles : Fine-grained Access Control at different levels
- ⚡ &nbsp;and more ...

### App Store for Workflow Automations

We provide different integrations in three main categories. See <a href="./setup-and-usages/app-store" target="_blank">App Store</a> for details.

- ⚡ &nbsp;Chat : Slack, Discord, Mattermost, and etc
- ⚡ &nbsp;Email : AWS SES, SMTP, MailerSend, and etc
- ⚡ &nbsp;Storage : AWS S3, Google Cloud Storage, Minio, and etc

### Programmatic Access

We provide the following ways to let users to invoke actions in a programmatic way. You can use a token (either JWT or Social Auth) to sign your requests for authorization to NocoDB. 

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

### Sync Schema

We allow you to sync schema changes if you have made changes outside NocoDB GUI. However, it has to be noted then you will have to bring your own schema migrations for moving from environment to others. See <a href="./setup-and-usages/sync-schema" target="_blank">Sync Schema</a> for details.

### Audit 

We are keeping all the user operation logs under one place. See <a href="./setup-and-usages/audit" target="_blank">Audit</a> for details.

##  Why are we building this?
Most internet businesses equip themselves with either spreadsheet or a database to solve their business needs. Spreadsheets are used by a Billion+ humans collaboratively every single day. However, we are way off working at similar speeds on databases which are way more powerful tools when it comes to computing. Attempts to solve this with SaaS offerings has meant horrible access controls, vendor lockin, data lockin, abrupt price changes & most importantly a glass ceiling on what's possible in future.

## Our Mission
Our mission is to provide the most powerful no-code interface for databases which is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on internet. 

# Contributions

Thanks for spending your time to contribute! The following is a set of guidelines for contributing to NocoDB. 


## Pull Request Guidelines

- When you create a PR, you should fill in all the info defined in this [template](https://github.com/nocodb/nocodb/blob/master/.github/pull_request_template.md).

- We adopt [Gitflow Design](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow). However, we do not have release branches. 

    ![git flow design](https://wac-cdn.atlassian.com/dam/jcr:cc0b526e-adb7-4d45-874e-9bcea9898b4a/04%20Hotfix%20branches.svg?cdnVersion=176)

- The `master` branch is just a snapshot of the latest stable release. All development should be done in dedicated branches. 
**Do not submit PRs against the `master` branch.**

- Checkout a topic branch from the relevant branch, e.g. `develop`, and merge back against that branch.

- Multiple small commits are allowed on the PR - They will be squashed into one commit before merging.

- If your changes are related to a special issue, add `ref: #xxx` to link the issue where xxx is the issue id.

## Development Setup

Please refer to [Development Setup](https://github.com/nocodb/nocodb#development-setup).

### Committing Changes

We encourage all contributors to commit messages following [Commit Message Convention](./COMMIT_CONVENTION.md).

### Applying License

We require a CLA (Contributor License Agreement). This is a one-time process. Please click this [link](https://cla-assistant.io/nocodb/nocodb) to agree to the CLA for nocodb/nocodb. 

You can also share your thoughts and discuss with our community members via [discord](https://discord.gg/5RgZmkW) or [Github Discussion](https://github.com/nocodb/nocodb/discussions). We also share our [Immediate Roadmap](https://github.com/nocodb/nocodb/projects/1) and all opinions are welcome.

## Support

If you have any issues or questions, you can reach out for help in our [discord](https://discord.gg/5RgZmkW).
