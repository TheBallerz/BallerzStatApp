// Takes a result set from NBA API and returns an object for each row
function rowsToObjects(resultSet) {
  
    // Take headers property from resultSet and put it into a variable called headers
    // Take the rowSet property and put it into a variable called rowSet
    const headers = resultSet.headers || [];
    const rowSet = resultSet.rowSet || [];
  
    // Goes through each row and returns a new array
    return rowSet.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
  
      return obj;
    });
  }

module.exports = {
  rowsToObjects,
};
