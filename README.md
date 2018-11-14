# novusphere-db (node js impl.)

 A MongoDB based database API for interacting with data indexed from an underlying blockchain

## Build Setup 

 ``` bash
# install dependencies
npm install

# start process
npm start
``` 

## Recommended Tools

[.NET Core Framework](https://www.microsoft.com/net/download/) (not required)

[Visual Studio Code](https://code.visualstudio.com/)

[npm for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.vscode-npm-script)

[MongoDB](https://www.mongodb.com/)

[MongoDB Reference](https://docs.mongodb.com/manual/reference/)

## Notes for using eos-forum locally

nsdb is configured by default at start up to begin listening to both the `eosforumrcpp` contract and `novuspheredb` contract on the EOS main net blockchain.

[Download the gh-pages zip](https://github.com/Novusphere/eos-forum/tree/gh-pages) or [compile](https://github.com/Novusphere/eos-forum) eos-forum's front end interface and then open it locally in your browser. At the top middle area of the interface, click "Settings" and then "Raw" and change `novusphere_api` to `http://localhost:8099` or whatever end point you have novusphere-db listening to. Hit "Save" and your interface should now be using your own local novusphere-db node.

Errors such as `failed to get actions` are common and are a result of the block producer history API timing out / failing. You can change the block producer api nsdb uses in `config.json`.





