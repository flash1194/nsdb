const axios = require('axios');

(async function() {

    const tx = (await axios.post('https://eos.greymass.com/v1/history/get_transaction',
        { id: '2ba6ba6ef62b823ac53d22a8da25aa716058328c5b72add9c8f5d64a6b2a8dee' })).data;


    const action = tx.trx.trx.actions[0];

    try
    {
        console.log(action.data.proposal_json);
        const json = JSON.parse(action.data.proposal_json);
    }
    catch (ex) {
        console.log(ex);
    }

})();