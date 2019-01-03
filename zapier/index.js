const request = require('request')

module.exports = {
  sendDiffEmail: function(data) {
    return new Promise(function(resolve, reject) {
      buildTableForDiffEmail(data)
        .then(table => {
          let options = {
            method: 'post',
            body: JSON.stringify({table: table}), // this could be a problem
            json: true,
            url: process.env.ZAPIER_DIFF_EMAIL_ENDPOINT
          }
          
          request(options, function(err, response, body) {
            if (err) { console.log(err); return reject(err); }
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
        // make a row in the table for each record
        tableMarkup += `
          <tr>
            <td>${record.hrbp}</td>
            <td><a hred="${record.url}"${record.id}</td>
          </tr>
        `
      }
      
      // close the table mark up once done
      tableMarkup += '</table>'
      
      return resolve(tableMarkup)
    });
  }
}
