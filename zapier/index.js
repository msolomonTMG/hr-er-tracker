const request = require('request')

module.exports = {
  sendDiffEmail (changedRecords) {
    return new Promise(function(resolve, reject) {
      helpers.buildTableForDiffEmail(changedRecords)
        .then(table => {
          let options = {
            method: 'post',
            body: {table: table}, // this could be a problem
            json: true,
            url: process.env.ZAPIER_DIFF_EMAIL_ENDPOINT
          }
          
          request(options, function(err, response, body) {
            if (err) { console.log(err); return reject(err); }
            console.log(body)
            return resolve(body)
          })
        })  
    });
    
  }
}

const helpers = {
  buildTableForDiffEmail(changedRecords) {
    return new Promise((resolve, reject) => {
      let tableMarkup = `
        <table>
          <tr>
            <th>HRBP</th>
            <th>Issue Record ID</th>
          </tr>
      `
      for (const record of changedRecords) {
        console.log(record)
        // make a row in the table for each record
        tableMarkup += `
          <tr>
            <td>${record.hrbp}</td>
            <td><a href="https://airtable.com/tblDxNnp3dk18ADBH/viwjS3qRjryZ1h9yJ/${record.masterRecordId}">${record.get('Issue Key')}</a></td>
          </tr>
        `
      }
      
      // close the table mark up once done
      tableMarkup += '</table>'
      
      return resolve(tableMarkup)
    });
  }
}
