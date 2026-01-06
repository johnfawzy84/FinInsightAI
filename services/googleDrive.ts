import { GoogleUser } from '../types';

// Add type definitions for Google API and Google Identity Services on the global window object
declare global {
  /* Using the existing AIStudio interface to avoid conflicts and ensure consistency */
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    gapi: any;
    google: any;
    aistudio?: AIStudio;
  }
}

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

/**
 * ATTENTION: You MUST replace this CLIENT_ID with the one from your Google Cloud Console.
 * Make sure to add your app's URL to "Authorized JavaScript origins" in the Google Console.
 */
const CLIENT_ID = '905786154569-8e5q7441p0p90t0v94j1m6h8p769f3u1.apps.googleusercontent.com'; 

let tokenClient: any;
let gapiInited = false;
let gsisInited = false;

export const initGoogleClient = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const checkInit = () => {
      if (gapiInited && gsisInited) resolve();
    };

    if (CLIENT_ID.startsWith('YOUR_CLIENT_ID')) {
        console.warn("Google Drive Sync: Please configure your CLIENT_ID in services/googleDrive.ts");
        return;
    }

    try {
        // Initialize GAPI
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;
          checkInit();
        });

        // Initialize GIS
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', // defined at login
        });
        gsisInited = true;
        checkInit();
    } catch (e) {
        console.error("Google Auth Init Error:", e);
        reject(e);
    }
  });
};

export const loginToGoogle = (): Promise<GoogleUser> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
        reject(new Error("Google Identity Client not initialized. Check your Client ID."));
        return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }
      
      try {
        const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` }
        });
        const userInfo = await userInfoResp.json();
        
        resolve({
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          accessToken: resp.access_token
        });
      } catch (err) {
        reject(err);
      }
    };

    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

const FILE_NAME = 'finsight_backup_cloud.json';

export const saveToDrive = async (data: any): Promise<void> => {
  try {
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    const files = response.result.files;
    const fileId = files && files.length > 0 ? files[0].id : null;

    const metadata = {
      name: FILE_NAME,
      mimeType: 'application/json',
    };

    const fileContent = JSON.stringify(data);
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      close_delim;

    if (fileId) {
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });
    } else {
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });
    }
  } catch (err) {
    console.error('Error saving to drive:', err);
    throw err;
  }
};

export const loadFromDrive = async (): Promise<any | null> => {
  try {
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    const files = response.result.files;
    if (!files || files.length === 0) return null;

    const fileId = files[0].id;
    const fileResp = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });

    // Handle string or object return from gapi
    return typeof fileResp.result === 'string' ? JSON.parse(fileResp.result) : fileResp.result;
  } catch (err) {
    console.error('Error loading from drive:', err);
    throw err;
  }
};