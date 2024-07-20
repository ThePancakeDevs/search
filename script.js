let fileHandles = [];
let scannedFiles = false;

// Initialize IndexedDB
const dbPromise = idb.openDB('pancakeSearchDB', 1, {
    upgrade(db) {
        db.createObjectStore('files', { keyPath: 'url' });
    },
});

document.getElementById('loadFolderButton').addEventListener('click', async () => {
    fileHandles = [];
    scannedFiles = false;
    document.getElementById('progress').style.display = 'block';

    const directoryHandle = await window.showDirectoryPicker();
    await loadFiles(directoryHandle, '');
    await saveDataToIndexedDB();

    document.getElementById('searchBar').style.display = 'inline-block';
    document.getElementById('searchFilters').style.display = 'inline-block';
    scannedFiles = true;
    setTimeout(() => {
        document.getElementById('progress').style.display = 'none';
    }, 500);

    document.getElementById('searchIcon').style.display = 'block';

    document.getElementById('bucketHolder').innerHTML = `<button id="loadFolderButton" class="app-btn app-btn-outline-success"><i class="icons10-checkmark"></i><span>Select overrides folder</span></button>`;
});

async function loadFiles(directoryHandle, path) {
    let fileCount = 0;

    for await (const entry of directoryHandle.values()) {
        fileCount++;
    }

    let processedFiles = 0;

    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.html')) {
            const fullPath = `${path}/${entry.name}`;
            const normalizedPath = fullPath.replace(/\/$/, ''); // Remove trailing slashes
            const fileData = await processFile(entry, normalizedPath);
            if (fileData) {
                fileHandles.push(fileData);
            }
        } else if (entry.kind === 'directory') {
            await loadFiles(entry, `${path}/${entry.name}`);
        }
        processedFiles++;
        const progress = (processedFiles / fileCount) * 100;
    }
}

async function processFile(fileHandle, path) {
    const file = await fileHandle.getFile();
    const content = await file.text();
    const titleMatch = content.match(/<meta property="hnet:title" content="([^"]+)" \/>/);
    const descriptionMatch = content.match(/<meta property="hnet:description" content="([^"]+)" \/>/);

    if (titleMatch && descriptionMatch) {
        const title = titleMatch[1].trim();
        const description = descriptionMatch[1].trim();
        const urlPath = `${path}`.replace(/^\//, ''); // Remove leading slash
        const domain = `https://${urlPath.split('/')[0]}`; // Use the base domain for favicon
        const httpsUrl = `https://${urlPath}`;
        const hnetUrl = `hnet://${urlPath}`;
        const faviconUrl = await fetchFavicon(domain);

        return {
            title: title,
            url: hnetUrl,
            httpsUrl: httpsUrl,
            description: description,
            favicon: faviconUrl
        };
    }
    return null;
}

async function fetchFavicon(domain) {
    try {
        const response = await fetch(`${domain}/favicon.ico`);
        if (response.ok) {
            return URL.createObjectURL(await response.blob());
        }
    } catch (error) {
        console.error('Error fetching favicon:', error);
    }
    return '/default-favicon.png'; // Path to a default favicon image if fetching fails
}

async function saveDataToIndexedDB() {
    const db = await dbPromise;
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    for (const item of fileHandles) {
        await store.put(item);
    }
    await tx.done;
}

async function loadDataFromIndexedDB() {
    const db = await dbPromise;
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const allData = await store.getAll();
    return allData;
}

// Define multiple ads
const ads = [
    {
        title: "Twtr, It's what happened.",
        url: "https://twtr.com",
        description: "The #1 social media platform on Hac3dNetwork.",
    },
    {
        title: "InnocentNLMB is watching you...",
        url: "https://innocentnlmb.vercel.app",
        description: "JK! Or am I...",
    },
    {
        title: "Want more functionality?",
        url: "https://addons.pancake.ca",
        description: "Get some addons from Pancake Addons!",
    }
];

// Function to create a random ad
function createRandomAd() {
    const adChance = Math.random(); // Random number between 0 and 1
    if (adChance < 0.3) { // 30% chance to show an ad
        const randomIndex = Math.floor(Math.random() * ads.length);
        const ad = ads[randomIndex];
        const adDiv = document.createElement('div');
        adDiv.classList.add('result');
        adDiv.innerHTML = `
            <div class="result-item ad">
                <div class="linkHeader">
                    <span class="ad-label">AD</span><a href="${ad.url}" class="result-title" target="_blank">${ad.title}</a><br>
                    <span class="result-url">${ad.url}</span><br>
                </div>
                <span class="result-description">${ad.description}</span>
            </div>
        `;
        return adDiv;
    }
    return null;
}

async function searchFiles() {
    const searchTerm = document.getElementById('searchBar').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    if (!scannedFiles || searchTerm === '') {
        return;
    }

    // Add a random ad before the results
    const ad = createRandomAd();
    if (ad) {
        resultsContainer.appendChild(ad);
    }

    const data = await loadDataFromIndexedDB();
    const seenResults = new Set();

    for (const item of data) {
        const title = item.title;
        const description = item.description;
        const hnetUrl = item.url;
        const favicon = item.favicon;

        // Only include results matching the search term
        if (title.toLowerCase().includes(searchTerm) || description.toLowerCase().includes(searchTerm)) {
            const uniqueKey = `${title}-${hnetUrl}`;

            if (!seenResults.has(uniqueKey)) {
                const resultDiv = document.createElement('div');
                resultDiv.classList.add('result');
                resultDiv.innerHTML = `
                    <div class="result-item">
                        <div class="linkHeader">
                            <img src="${favicon}" alt="Favicon" class="result-favicon"/>
                            <a href="${item.httpsUrl}" class="result-title" target="_blank">${title}</a><br>
                            <span class="result-url">${hnetUrl}</span><br>
                        </div>
                        <span class="result-description">${description}</span>
                    </div>
                `;
                resultsContainer.appendChild(resultDiv);
                seenResults.add(uniqueKey);
            }
        }
    }
}
