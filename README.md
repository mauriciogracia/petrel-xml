# Petrel XML

This is a VScode extension that aims to help development for the Petrel platform using XML files

## Functionality

- Navigate to functions and rules definitions from where they are being used
- Show all references where a rule or function is being used
- Provide autocomplete based on existing functions and rules

## Installing 
- download the *petrel-xml-0.9.1.vsix* file
- run this command *code --install-extension petrel-xml-0.9.1.vsix**

## Running and Debugging

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open an Petrel XML document 
- The extension logs on the Output tab under the Petrel-XML Language Server

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   ├── test // End to End tests for Language Client / Server
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```