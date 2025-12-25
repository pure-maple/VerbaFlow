
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
let manualAccessToken = ''; // Store the manual token locally in the module

// Allow setting the manual token from the UI
export const setManualAccessToken = (token: string) => {
    manualAccessToken = token.trim();
    if (manualAccessToken) {
        console.log("[VerbaFlow] Manual Access Token set. OAuth origin checks will be bypassed.");
    }
};

// Initialize Google API Client and Identity Services
export const initGoogleDrive = (clientId: string, apiKey: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // Log for debugging
    console.log("[VerbaFlow] Initializing Drive API...");
    
    // If we have a manual token, we don't strictly need Client ID for REST calls, 
    // but we still need API Key for GAPI initialization.
    if (!apiKey) {
      console.warn("Google Drive API Key missing");
      resolve(false);
      return;
    }

    const checkAuth = () => {
      // If manual token is provided, we essentially treat auth as "ready" 
      // as long as GAPI (for Picker) is loaded.
      if (gapiInited) {
        console.log("[VerbaFlow] Google Services Initialized (GAPI Ready).");
        resolve(true);
      }
    };

    const gapiLoaded = () => {
      window.gapi.load('client:picker', async () => {
        try {
          // 1. Initialize with API Key (Required for Picker)
          await window.gapi.client.init({
            apiKey: apiKey,
            discoveryDocs: [], 
          });

          // 2. Try to load Drive API
          try {
             await window.gapi.client.load('drive', 'v3');
          } catch (apiLoadError) {
             console.warn("Drive API Definition failed to load.", apiLoadError);
          }
          
          gapiInited = true;
        } catch (error) {
          console.error("Critical GAPI Initialization Error:", error);
        } finally {
          checkAuth();
        }
      });
    };

    const gisLoaded = () => {
      try {
        // Only init Token Client if we have a Client ID. 
        // If user is using Manual Token + No Client ID, we skip this to avoid errors.
        if (clientId) {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
            callback: '', // defined later
            });
            gisInited = true;
        }
      } catch (error) {
        console.error("Google Identity Services Initialization Error:", error);
      } finally {
        checkAuth();
      }
    };

    if (window.gapi) gapiLoaded();
    if (window.google) gisLoaded();
  });
};

// --- Force Re-Auth (New Feature for Troubleshooting) ---
export const requestDriveRelogin = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (!tokenClient) {
            alert("Drive Client not initialized yet.");
            resolve(false);
            return;
        }

        // Force prompt to ensure user sees the checkboxes again
        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                console.error("Relogin Error:", resp);
                resolve(false);
            } else {
                if(window.gapi?.client) {
                    window.gapi.client.setToken(resp);
                }
                console.log("Relogin Successful. Scope granted:", resp.scope);
                resolve(true);
            }
        };

        // 'consent' forces the screen where user must check boxes
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
};

// --- Helper: Ensure Token Exists ---
const ensureToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        // 0. PRIORITY: Check Manual Token first
        if (manualAccessToken) {
            // Check if we need to sync it to gapi client for other libs
            if (window.gapi?.client) {
                window.gapi.client.setToken({ access_token: manualAccessToken });
            }
            resolve(manualAccessToken);
            return;
        }

        // 1. Check if GAPI has a valid token
        const existingToken = window.gapi?.client?.getToken();
        if (existingToken && existingToken.access_token) {
            resolve(existingToken.access_token);
            return;
        }

        // 2. If not, request one via GIS
        if (!tokenClient) {
            reject(new Error("Google Drive not initialized (Client ID missing or Auth flow not ready). Try using a Manual Token in Settings."));
            return;
        }

        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                console.error("Token Error:", resp);
                reject(resp);
            } else {
                if(window.gapi.client) {
                    window.gapi.client.setToken(resp);
                }
                resolve(resp.access_token);
            }
        };

        tokenClient.requestAccessToken({});
    });
};


// --- Google Picker (Select File) ---

export interface DriveFileSelection {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

export const openDrivePicker = (
  clientId: string, 
  apiKey: string, 
  mimeTypes: string,
  callback: (file: DriveFileSelection) => void
) => {
  if (!window.google || !window.google.picker) {
    alert("Google Drive services are initializing. Please wait.");
    return;
  }

  // Helper to actually build the picker
  const buildPicker = (authToken: string) => {
      try {
          const pickerCallback = (data: any) => {
            if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
              const doc = data[window.google.picker.Response.DOCUMENTS][0];
              callback({
                id: doc[window.google.picker.Document.ID],
                name: doc[window.google.picker.Document.NAME],
                mimeType: doc[window.google.picker.Document.MIME_TYPE],
                url: doc[window.google.picker.Document.URL]
              });
            }
          };

          const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
          view.setMimeTypes(mimeTypes);

          // Note: PickerBuilder requires AppId (Client ID) usually, but sometimes works with just token/key depending on config.
          const builder = new window.google.picker.PickerBuilder()
            .setDeveloperKey(apiKey)
            .setOAuthToken(authToken)
            .addView(view)
            .setCallback(pickerCallback);
          
          if (clientId) {
              builder.setAppId(clientId);
          }

          const picker = builder.build();
          picker.setVisible(true);
      } catch (e) {
          console.error("Error creating Google Picker:", e);
          alert("Failed to open file picker. Check console.");
      }
  };

  // Logic: Use Manual Token if available, else standard flow
  if (manualAccessToken) {
      buildPicker(manualAccessToken);
      return;
  }

  if (!tokenClient) {
      alert("Auth client not initialized. Check Client ID or use Manual Token.");
      return;
  }

  tokenClient.callback = async (response: any) => {
    if (response.error) {
      console.error("GIS Error:", response);
      if (response.error === 'popup_closed_by_user') return;
      alert(`Google Auth Error: ${response.error}`);
      return;
    }
    if(window.gapi?.client) {
        window.gapi.client.setToken(response);
    }
    buildPicker(response.access_token);
  };

  tokenClient.requestAccessToken({});
};

// --- File Operations ---

export const getDriveFileContent = async (fileId: string): Promise<Blob> => {
  const accessToken = await ensureToken();
  
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
      if (response.status === 401) {
          throw new Error("Access Token Expired. Please refresh your Manual Token in Settings.");
      }
      throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return await response.blob();
};

export const getDriveFileText = async (fileId: string): Promise<string> => {
    const blob = await getDriveFileContent(fileId);
    return await blob.text();
};

// Helper: Get Metadata manually (when bypass picker)
export const getDriveFileMetadata = async (fileId: string): Promise<{ name: string, mimeType: string }> => {
    const accessToken = await ensureToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!response.ok) throw new Error("Failed to fetch file metadata");
    return await response.json();
};

// Helper: List files for custom picker (Supports Folder Navigation & Search)
export const listDriveFiles = async (
    category: 'video' | 'audio' | 'srt' | 'all',
    folderId: string = 'root',
    searchTerm: string = ''
): Promise<Array<{ id: string, name: string, mimeType: string, modifiedTime: string, size?: string }>> => {
    const accessToken = await ensureToken();
    
    // Base Query
    let q = `trashed = false`;
    
    // Logic: If search term is present, we ignore folder hierarchy to do a global search.
    // Otherwise, we look in the specific folder.
    if (searchTerm.trim()) {
        const cleanTerm = searchTerm.replace(/'/g, "\\'"); // escape single quotes
        q += ` and name contains '${cleanTerm}'`;
    } else {
        q += ` and '${folderId}' in parents`;
    }
    
    // Type Filters
    let typeQuery = "";
    if (category === 'video') {
        typeQuery = "mimeType contains 'video/'";
    } else if (category === 'audio') {
        typeQuery = "mimeType contains 'audio/'";
    } else if (category === 'srt') {
        typeQuery = "(fileExtension = 'srt' or fileExtension = 'vtt' or fileExtension = 'ass' or fileExtension = 'json' or mimeType = 'text/plain')";
    }

    if (category !== 'all' && typeQuery) {
        // If searching globally (with searchTerm), we usually ONLY want the target files, not folders.
        // If navigating folders (no searchTerm), we ALWAYS want folders to be visible for navigation.
        if (searchTerm.trim()) {
            q += ` and (${typeQuery})`;
        } else {
            q += ` and (mimeType = 'application/vnd.google-apps.folder' or ${typeQuery})`;
        }
    }

    const params = new URLSearchParams({
        q: q,
        // Order by: Folders first, then modification time
        orderBy: "folder desc, modifiedTime desc",
        fields: "files(id, name, mimeType, modifiedTime, size)",
        pageSize: "100",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true"
    });

    console.log("[VerbaFlow] Drive Query:", q);

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Access Token Expired");
        }
        if (response.status === 403) {
            throw new Error("Permission Denied (403). Ensure you granted 'See all files' permission.");
        }
        throw new Error(`Drive Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
};

export const saveToDrive = async (
  content: string, 
  filename: string, 
  mimeType: string = 'text/plain'
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
        const accessToken = await ensureToken();
        await uploadFile(content, filename, mimeType, resolve, reject, accessToken);
    } catch (e) {
        reject(e);
    }
  });
};

const uploadFile = async (content: string, filename: string, mimeType: string, resolve: any, reject: any, accessToken: string) => {
  try {
    const fileContent = new Blob([content], { type: mimeType });
    const metadata = {
      name: filename,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form,
    });
    
    if (!response.ok) {
         if (response.status === 401) {
            throw new Error("Access Token Expired. Please refresh your Manual Token in Settings.");
         }
         throw new Error("Upload request failed");
    }

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

// Helper: Extract ID from various Google Drive URL formats
export const extractDriveFileId = (input: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim();
    
    // Pattern 1: URL with /d/ID/
    const urlMatch = trimmed.match(/\/d\/([-a-zA-Z0-9_]+)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];

    // Pattern 2: URL with ?id=ID
    const queryMatch = trimmed.match(/[?&]id=([-a-zA-Z0-9_]+)/);
    if (queryMatch && queryMatch[1]) return queryMatch[1];
    
    // Pattern 3: Raw ID (Alphanumeric + _ -, typically > 20 chars)
    if (trimmed.match(/^[-a-zA-Z0-9_]{20,}$/)) return trimmed;

    return null;
};
