import fs from 'fs';
import csvParser from 'csv-parser';

/**
 * Parse CSV file and extract contacts
 * @param {String} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of contact objects
 */
export const parseContactsCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const contacts = [];
    const errors = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        // Validate required fields
        const phoneNumber = row.phone_number || row.Phone || row.phone;
        const firstName = row.first_name || row.FirstName || row.first || row.First;
        const lastName = row.last_name || row.LastName || row.last || row.Last;

        if (!phoneNumber) {
          errors.push(`Missing phone_number in row: ${JSON.stringify(row)}`);
          return;
        }

        contacts.push({
          phone_number: phoneNumber.trim(),
          first_name: firstName?.trim() || '',
          last_name: lastName?.trim() || '',
        });
      })
      .on('end', () => {
        if (contacts.length === 0) {
          reject(new Error('No valid contacts found in CSV file'));
        } else {
          resolve({ contacts, errors });
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Validate CSV file format
 */
export const validateCSVHeaders = (filePath) => {
  return new Promise((resolve, reject) => {
    let headers = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', () => {
        // Just need to read headers, can stop after first row
      })
      .on('end', () => {
        const requiredFields = ['phone_number', 'first_name', 'last_name'];
        const hasRequired = requiredFields.some(field => 
          headers.some(header => 
            header.toLowerCase().includes(field.replace('_', ''))
          )
        );

        if (!hasRequired) {
          reject(new Error(`CSV must include columns: ${requiredFields.join(', ')}`));
        } else {
          resolve(true);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};