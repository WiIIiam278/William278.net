const http = require("http");
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const sanitizeFileName = require('sanitize-filename')
const wikiLinks = require('markdown-it-wikilinks')({
    postProcessPageName: (pageName) => {
        pageName = pageName.trim()
        pageName = pageName.split('/').map(sanitizeFileName).join('/')
        pageName = pageName.replace(/\s+/, '-')
        return pageName
    },
    uriSuffix: ''
})
const prism = require('markdown-it-prism');
const MarkdownIt = require('markdown-it'), md = new MarkdownIt({
    html: true,
    xhtmlOut: true,
    breaks: true
}).use(wikiLinks).use(prism, {defaultLanguage: 'yml'});
const gitPullOrClone = require('git-clone-or-pull');
const appRoot = require('app-root-path');

const {PROJECTS} = require(`${appRoot}/frontend/projects`);

const DOCS_PAGE_TEMPLATE = fs.readFileSync('frontend/docs/docs.html').toString();
const BLANK_PAGE_TEMPLATE = fs.readFileSync('frontend/blank.html').toString();
const CHECK_DOCUMENT_ENDS = ['', '.html', '.md']

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 8000;

const cachedTicketFiles = new Map();

function fetchPlugin(repository, name) {
    let wikiRepository = repository + '.wiki.git';
    const filePath = `${appRoot}/frontend/docs/${name.toLowerCase()}`;
    gitPullOrClone(wikiRepository, filePath, function (err) {
        if (err) {
            console.error('Error pulling ' + wikiRepository + ' to ' + filePath)
            console.error(err);
            return;
        }
        console.log('Updated ' + name);
    });
}

// Fetch repositories
for (let i = 0; i < PROJECTS.length; i++) {
    let project = PROJECTS[i];
    if (project.documentation === true) {
        fetchPlugin(project.repository, project.name);
    }
}

const requestListener = function (request, response) {
    try {
        if (request.url.endsWith('/') && request.url.length > 1) {
            response.writeHead(302, {
                'Location': '../' + request.url.slice(0, -1).substring(request.url.indexOf('/') + 1)
            })
            response.end();
            return;
        }
        if (request.method === 'GET') {
            sendRequestedPage('frontend/' + request.url.substring(request.url.indexOf('/') + 1), response);
        } else if (request.method === 'POST') {
            handleWebhook(request.url.substring(request.url.indexOf('/') + 1), request, response);
        } else {
            response.writeHead(405);
            response.end('Unsupported method.')
        }
    } catch (error) {
        response.writeHead(500);
        fs.createReadStream('frontend/500.html').pipe(response);
        console.log(error);
    }
}

function handleWebhook(requestPath, request, response) {
    try {
        if (requestPath.startsWith('api/update-docs')) {
            let data = '';
            request.on('data', chunk => {
                data += chunk;
            })
            request.on('end', () => {
                try {
                    const DATA = JSON.parse(data);

                    let repository = DATA.repository.svn_url;
                    let name = '';

                    // Validate repository
                    let isValid = false;
                    for (let i = 0; i < PROJECTS.length; i++) {
                        let project = PROJECTS[i];
                        if (project.repository === repository && project.documentation === true) {
                            name = project.name;
                            isValid = true;
                            break;
                        }
                    }
                    if (isValid === false) {
                        response.writeHead('400');
                        response.end('Invalid repository');
                        return;
                    }

                    // Update repository
                    fetchPlugin(repository, name);

                    response.writeHead('200');
                    response.end('Updated documentation');
                } catch (error) {
                    response.writeHead('500');
                    response.end('Error parsing data body');
                }
            })
        } else {
            response.writeHead('404');
            response.end('Not found')
        }
    } catch (error) {
        response.writeHead('500');
        response.end('Unknown server error');
        console.error(error);
    }
}

function sendRequestedPage(targetResourcePath, response) {
    for (let i = 0; i < CHECK_DOCUMENT_ENDS.length; i++) {
        let pathToCheck = targetResourcePath + CHECK_DOCUMENT_ENDS[i];
        if (fs.existsSync(pathToCheck) || pathToCheck.startsWith("frontend/transcript")) {
            if (!pathToCheck.startsWith("frontend/transcript")) {
                if (fs.statSync(pathToCheck).isDirectory()) {
                    sendRequestedPage(pathToCheck + '/index.html', response);
                    return;
                }
            }
            sendPage(response, fs, pathToCheck);
            return;
        }
    }

    response.writeHead(404);
    fs.createReadStream('frontend/404.html').pipe(response);
}

function sendPage(response, fs, targetPath) {
    // Render MarkDown to html file
    if (targetPath.endsWith('.md')) {
        let sideBarMarkDown = '';
        let contentMarkDown = md.render(fs.readFileSync(targetPath).toString());
        let template = BLANK_PAGE_TEMPLATE;

        if (targetPath.startsWith("frontend/docs")) {
            const SIDEBAR_PATH = targetPath.replace(targetPath.substring(targetPath.lastIndexOf('/') + 1), '_Sidebar.md');
            if (fs.existsSync(SIDEBAR_PATH)) {
                sideBarMarkDown = md.render(fs.readFileSync(SIDEBAR_PATH).toString());
            }
            template = DOCS_PAGE_TEMPLATE;
        }

        let pageTitle = targetPath.substring(targetPath.lastIndexOf('/') + 1)
            .replace('-', ' ')
            .replace('.md', '');

        // Capitalize first letter
        pageTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);


        response.writeHead(200);
        response.end(template.replace('{PAGE_SIDEBAR_CONTENT}', sideBarMarkDown)
            .replace('{PAGE_CONTENT}', contentMarkDown)
            .replace('{PROJECT_TITLE}', targetPath.split('/')[2])
            .replace('{PAGE_TITLE}', pageTitle)
            .replace('{PAGE_TITLE}', pageTitle));
        return;
    }

    // Send scalable vector graphic
    if (targetPath.endsWith('.svg')) {
        response.writeHead(200, {
            'Content-Type': 'image/svg+xml'
        });
        fs.createReadStream(targetPath).pipe(response)
        return;
    }

    if (targetPath.startsWith("frontend/transcript")) {
        try {
            let ticketFormat = fs.readFileSync("frontend/ticket.html", "utf8");
            let targetUrl = targetPath.split("?")[1];
            let formattedUrl = new URL(targetUrl);
            if (formattedUrl.hostname !== "cdn.discordapp.com") {
                response.writeHead(404);
                fs.createReadStream('frontend/404.html').pipe(response);
                return;
            }

            if (cachedTicketFiles.has(formattedUrl)) {
                if (cachedTicketFiles.get(formattedUrl).expiry > new Date()) {
                    cachedTicketFiles.delete(formattedUrl);
                } else {
                    response.writeHead(200);
                    response.end(cachedTicketFiles.get(formattedUrl).page);
                    return;
                }
            }

            fetch(targetUrl).then(response => {
                if (response.status !== 200) {
                    throw response.status;
                }
                if (!response.headers.get("Content-Disposition").endsWith(".html")) {
                    throw 400;
                }
                return response.text();
            }).then(responseText => {
                let responseHtml = responseText.replace("<html>", "")
                    .replace("</html>", "")
                    .replace("<!DOCTYPE html>", "");
                ticketFormat = ticketFormat.replace("{{TRANSCRIPT_INFO}}", "");
                ticketFormat = ticketFormat.replace("{{TRANSCRIPT_CONTENT}}", responseHtml);
                cachedTicketFiles.set(formattedUrl, {
                    "page": ticketFormat,
                    "expiry": new Date().getHours() + 3
                });
                response.writeHead(200);
                response.end(ticketFormat);
            }).catch(error => {
                handleTicketFetchError(error, response);
            })
        } catch (error) {
            handleTicketFetchError(error, response);
        }
        return;
    }

    // Send other file
    response.writeHead(200);
    fs.createReadStream(targetPath).pipe(response)
}

// Start server
const server = http.createServer(requestListener);
server.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
    console.log('[Pterodactyl] Ready');
});

function handleTicketFetchError(error, response) {
    if (typeof error === "number") {
        switch (parseInt(error)) {
            case 403:
                response.writeHead(429);
                fs.createReadStream('frontend/429.html').pipe(response);
                return;
            case 400:
                response.writeHead(400);
                fs.createReadStream('frontend/400.html').pipe(response);
                return;
        }
    } else {
        console.log("Unexpected error: " + error);
    }
    response.writeHead(404);
    fs.createReadStream('frontend/404.html').pipe(response);
}