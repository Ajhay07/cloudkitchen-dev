import XLSX from 'xlsx';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { logger, LogLevel } from '@/lib/logger';

export interface SheetRow {
  [key: string]: string | number | boolean | null;
}

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
  totalRows: number;
  fileName: string;
}

export class SheetReader {
  async readFromUrl(url: string): Promise<SheetData> {
    try {
      logger.info('sheet', `Reading Google Sheet from URL: ${url}`);

      if (url.includes('docs.google.com/spreadsheets')) {
        return this.readGoogleSheet(url);
      } else {
        throw new Error('Invalid Google Sheets URL');
      }
    } catch (error) {
      logger.error('sheet', 'Failed to read sheet from URL', { error });
      throw error;
    }
  }

  async readFromFile(buffer: Buffer, fileName: string): Promise<SheetData> {
    try {
      logger.info('sheet', `Reading file: ${fileName}, size: ${buffer.length} bytes`);

      const extension = fileName.split('.').pop()?.toLowerCase();

      if (extension === 'csv') {
        return this.readCSV(buffer);
      } else if (extension === 'xlsx' || extension === 'xls') {
        return this.readExcel(buffer);
      } else {
        throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      logger.error('sheet', 'Failed to read file', { error, fileName });
      throw error;
    }
  }

  private readCSV(buffer: Buffer): SheetData {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    if (data.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = data[0].map((h: any) => String(h || '').trim());
    const rows = data.slice(1).map(row => {
      const rowData: SheetRow = {};
      headers.forEach((header, index) => {
        const value = row[index];
        rowData[header] = value !== undefined ? value : null;
      });
      return rowData;
    });

    logger.info('sheet', `Parsed CSV: ${headers.length} columns, ${rows.length} rows`);

    return {
      headers,
      rows,
      totalRows: rows.length,
      fileName: 'uploaded.csv',
    };
  }

  private readExcel(buffer: Buffer): SheetData {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    if (data.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = data[0].map((h: any) => String(h || '').trim());
    const rows = data.slice(1).map(row => {
      const rowData: SheetRow = {};
      headers.forEach((header, index) => {
        const value = row[index];
        rowData[header] = value !== undefined ? value : null;
      });
      return rowData;
    });

    logger.info('sheet', `Parsed Excel: ${headers.length} columns, ${rows.length} rows`);

    return {
      headers,
      rows,
      totalRows: rows.length,
      fileName: workbook.SheetNames[0] || 'uploaded.xlsx',
    };
  }

  private async readGoogleSheet(url: string): Promise<SheetData> {
    try {
      const spreadsheetId = this.extractSpreadsheetId(url);
      
      let auth;
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
      
      if (credentialsPath && require('fs').existsSync(credentialsPath)) {
        auth = await this.getAuthClient(credentialsPath);
      } else {
        logger.warn('sheet', 'Google credentials not found, using public sheet access');
        auth = undefined;
      }

      const sheets = google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A1:Z10000',
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error('No data found in Google Sheet');
      }

      const headers = rows[0].map((h: any) => String(h || '').trim());
      const dataRows = rows.slice(1).map(row => {
        const rowData: SheetRow = {};
        headers.forEach((header, index) => {
          const value = row[index];
          rowData[header] = value !== undefined ? value : null;
        });
        return rowData;
      });

      logger.info('sheet', `Parsed Google Sheet: ${headers.length} columns, ${dataRows.length} rows`);

      return {
        headers,
        rows: dataRows,
        totalRows: dataRows.length,
        fileName: 'google_sheet',
      };
    } catch (error) {
      logger.error('sheet', 'Failed to read Google Sheet', { error, url });
      throw error;
    }
  }

  private extractSpreadsheetId(url: string): string {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Invalid Google Sheets URL format');
    }
    return match[1];
  }

  private async getAuthClient(credentialsPath: string) {
    const { google } = require('googleapis');
    const { readFileSync } = require('fs');
    
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    const { OAuth2Client } = require('google-auth-library');
    return new OAuth2Client(client_id, client_secret, redirect_uris[0]);
  }
}