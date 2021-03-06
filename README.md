# Petrel XML

This is a VScode extension that aims to help development for the Petrel platform using XML files.

When you open the Petrel folder the extension builds the references between all the XML files
you can see this in on the `Output` tab under the `Petrel-XML Extension` channel, when that process
is finised a message `>>> petrel-xml extension is ready <<<`  will be shown

## Functionality

- Navigate to functions and rules definitions from where they are being used
- Show all references where a rule or function is being used
- Provide autocomplete based on existing functions and rules
- When XML files are added, renamed, relocated, deleted the change is detected and references are updated (including folder operations as well) - version 0.9.4 
- Detect declarations and references to IncludeBlocks, Groups and Buttons, use fast-xml-parser insted of parsing line by hand - version 0.9.5
- Detect set-var, clear-var, views and refresh actions on views - version 0.9.6

## Installing 
Two options
- Install it from https://marketplace.visualstudio.com/items?itemName=MauricioGraciaGutierrez.petrel-xml
- From VScode Extensios (CTRL + SHIFT + X) search for `petrel-xml`

Once is installed open your Petrel folder, right click on a the name of : rule, function , include block, Group, Buttons, etc.. 
   - go to definition
   - find all references  
   - CRTL + SPACEBAR to get suggestion based on the name of rule, functions , include blocks, Groups, Buttons, etc.. 

# If you are interested in maintining and improving this extension continue reading

To package the extension
$ vsce package

To publish the extension - https://code.visualstudio.com/api/working-with-extensions/publishing-extension
$ vsce publish <versionNumber>

If you are publishing for the fist time you need to setup personal access token and run 
$ npm i -g vsc

This uses webpack and the .vscodeignore and package.json settings

## Running and Debugging from VS code

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open an Petrel XML document 
- The extension logs on the `Output` tab under the `Petrel-XML Extension` channel

## Main Code Structure

```
.
????????? client // Language Client
???   ????????? src
???   ???   ????????? test // End to End tests for Language Client / Server
???   ???   ????????? extension.ts // Language Client entry point
????????? package.json // The extension manifest.
????????? server // Language Server
    ????????? src
        ????????? server.ts // Language Server entry point
```
