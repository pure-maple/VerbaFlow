// Type definitions for Google API global variables
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleDrive = (clientId: string, apiKey: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!clientId || !apiKey) {
      console.warn("Google Drive Client ID or API Key missing");
      resolve(false);
      return;
    }

    const gapiLoaded = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        checkAuth();
      });
    };

    const gisLoaded = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: '', // defined later
      });
      gisInited = true;
      checkAuth();
    };

    const checkAuth = () => {
      if (gapiInited && gisInited) {
        resolve(true);
      }
    };

    if (window.gapi) gapiLoaded();
    if (window.google) gisLoaded();
  });
};

export const saveToDrive = async (
  content: string, 
  filename: string, 
  mimeType: string = 'text/plain'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google Drive not initialized"));
      return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      await uploadFile(content, filename, mimeType, resolve, reject);
    };

    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

const uploadFile = async (content: string, filename: string, mimeType: string, resolve: any, reject: any) => {
  try {
    const fileContent = new Blob([content], { type: mimeType });
    const metadata = {
      name: filename,
      mimeType: mimeType,
    };

    const accessToken = window.gapi.client.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form,
    });
    
    const data = await response.json();
    if (data.id) {
      resolve(data.id);
    } else {
      reject(new Error("Upload failed"));
    }
  } catch (err) {
    reject(err);
  }
};
