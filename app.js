const express = require('express');
var app = express();
app.set('port', process.env.PORT || 5000);

//TODO: find a way to copy the bin/syncHrbpBasesToMaster
const zapier = require('./zapier')
const Airtable = require('airtable')
const firebase = require('firebase-admin')
const firebaseServiceAccount = JSON.parse(new Buffer(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('ascii'))
const masterBase = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID)
const hrbpBases = process.env.AIRTABLE_HRBP_BASES.split(' ')

firebase.initializeApp({
  credential: firebase.credential.cert(firebaseServiceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_NAME}.firebaseio.com`
});

const db = firebase.database()
const ref = db.ref('/')

app.post('/syncHrbpBasesToMaster', async function(req, res) {

  function getDatabaseSnapshot() {
    return new Promise(function(resolve, reject) {
      
      ref.once('value', (snapshot) => {
        return resolve(snapshot.val())
      })
      
    });
  }

  let recordsToSendInDiffEmail = []
  let dbSnapshot = getDatabaseSnapshot()
  dbSnapshot.then(snapshot => {
    // loop through each hrbp base
    let i = 0
    while (i < hrbpBases.length) {
      console.log(i)
      let k = i // we loop faster than we can process so use k as you would use i
      
      // initiate base
      const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(hrbpBases[i])
      // get all issues in the base
      base(process.env.AIRTABLE_TABLE_NAME).select({
          view: "All Issues",
          sort: [{field: process.env.AIRTABLE_SORT_FIELD_NAME, direction: "desc"}]
      }).eachPage(function page(issues, fetchNextPage) {
          // for each issue, check if we have it in firebase
          // if we dont, we'll set it later
          // if we do, check if anything changed. if it did, add it to the email
          // if nothings changed, we're still gonna set it in firebase cuz its easier to
          for (const issue of issues) {
            const id = issue.id 
            
            if (!snapshot) {
              // first time case if we've never saved to firebase before
              snapshot = {}
            } else if(!snapshot || !snapshot[id]) {
              // save this issue to our snapshot if not present down below
            } else if (!helpers.objectsAreEqual(issue.fields, snapshot[id])) {
              // there is something different about what is in airtable
              // and what we stored in firebase. lets add it to the email
              // and we'll sync them up when we set firebase
              recordsToSendInDiffEmail.push({
                id: issue.id,
                hrbp: issue.fields['HRBP'],
                url: issue.fields['Record URL'],
                masterRecordId: issue.fields['Master Record ID']
              })
              
              let diffs = helpers.objectDiffs(issue.fields, snapshot[id])
              console.log("diffs", diffs)
              // update the master airtable with the diffs
              masterBase(process.env.AIRTABLE_TABLE_NAME).update(issue.fields['Master Record ID'], diffs)
              console.log(helpers.objectDiffs(issue.fields, snapshot[id]))
            } else {
              // everything is the same
            }
            
            // either add this issue to firebase if it doesnt exist or
            // reset all of the fields to match what is in airtable
            snapshot[id] = issue.fields
          }
          
          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();

      }, function done(err) {
          if (err) { console.error(err); return; }
          if (k === hrbpBases.length - 1) {
            // update firebase with newest data
            ref.set(snapshot)
            // if we have diffs, send an email about em
            if (recordsToSendInDiffEmail.length > 0) {
              zapier.sendDiffEmail(recordsToSendInDiffEmail)
            }
            // send status
            res.sendStatus(200)
          }
          // return to end the process
          return
      });
      i++;
    }
  })



  const helpers = {
    objectsAreEqual (o1, o2) {
      // this function does not go into deep comparison
      // it turns object properties into strings and compares them that way
      // this means arrays and objects need to be in the same order which I am
      // assuming always happens since we set firebase to be the same as airtable
      for(let p in o1){
        if (o1[p] == undefined) {
          if (o2[p] == undefined) {
            return true
          } else {
            return false
          }
        } else if (o2[p] == undefined) {
          return false
        } else {
          if(o1[p].toString() != o2[p].toString()){
            console.log(`"${o1[p]}" is not equal to "${o2[p]}"`)
            return false;
          }
        }
      }
      return true;
    },
    objectDiffs (o1, o2) {
      let diffs = {}
      for (let p in o1) {
        if (o1[p] == undefined) {
          if (o2[p] != undefined) {
            diffs[p] = o1[p]
          }
        } else if (o2[p] == undefined) {
          diffs[p] = o1[p]
        } else if (o1[p].toString() != o2[p].toString()) {
          diffs[p] = o1[p]
        }
      }
      return diffs
    }
  }
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
module.exports = app;

console.log('I am awake :)')
