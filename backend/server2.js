const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const git = require('git-clone-or-pull');

// Spiget fetching
const {Spiget} = require('spiget');
const spiget = new Spiget("William278UpdateApi");

// GitHub flavoured Markdown parsing
const MarkdownIt = require('markdown-it');
const markdown = new MarkdownIt({
    html: true,
    xhtmlOut: true,
    breaks: true
}).use(require('markdown-it-wikilinks')({
    postProcessPageName: (pageName) => {
        pageName = pageName.trim()
        pageName = pageName.split('/').map(require('sanitize-filename')).join('/')
        pageName = pageName.replace(/\s+/, '-')
        return pageName
    },
    uriSuffix: ''
})).use(require('markdown-it-anchor'))
    .use(require('markdown-it-prism'), {
        defaultLanguage: 'yml'
    });

// App setup
const app = express();
const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 8000;
const frontend = path.join(__dirname, '../frontend');
const projects = JSON.parse(fs.readFileSync(path.join(__dirname, 'projects.json'), 'utf8'));


// Special page templates
const ticket = fs.readFileSync(path.join(__dirname, 'template/ticket.html'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, 'template/readme.html'), 'utf8');
const docs = fs.readFileSync(path.join(__dirname, 'template/docs.html'), 'utf8');
const error = fs.readFileSync(path.join(__dirname, 'template/error.html'), 'utf8');

// Handle transcripts
app.get('/transcript', (req, res) => {
    if (!req.url.endsWith('.html')) {
        if (!fs.existsSync(req.url)) {
            sendError(res, '404');
            return;
        }
        res.sendFile(req.url, {root: frontend});
        return;
    }
    let key = Object.keys(req.query)[0];
    if (key && key.length > 0) {
        try {
            let url = new URL(key);
            if (url.hostname !== 'cdn.discordapp.com') {
                sendError(res, '400', 'Invalid hostname.');
                return;
            }
        } catch (error) {
            sendError(res, '400', 'Invalid URL.');
            return;
        }
        fetch(key).then(response => {
            if (response.status !== 200) {
                throw response.status;
            }
            if (!response.headers.get("Content-Disposition").endsWith(".html, attachment")) {
                console.log("Attempted to parse an invalid html file " + response.headers.get("Content-Disposition"));
                throw 400;
            }
            return response.text();
        }).then(html => {
            return html.replace("<html>", "")
                .replace("</html>", "")
                .replace("<!DOCTYPE html>", "");
        }).then(html => {
            return formatTemplate(ticket, {'TRANSCRIPT_CONTENT': html});
        }).then(ticket => {
            res.send(ticket);
        }).catch(code => {
            sendError(res, code, 'That transcript is invalid or has expired.');
        });
        return;
    }
    sendError(res, '400', 'Bad request.');
});


// Handle post requests to update project documentation
app.post('/api/update-docs', (req, res) => {
    const name = req.body.name;
    const repository = req.body.repository;
    if (name && repository) {
        // Validate that projects contains the project
        if (projects.find(project => project.repository === repository && project.name.toLowerCase() === name.toLowerCase())) {
            updateDocs(repository, name);
            res.status(200).send('OK');
        }
    }
    res.status(400).send('Bad request');
});


// Serves a list of all projects and data
app.get('/api/projects', (req, res) => {
    res.send(projects);
});


// Serves data about a specific project by name
app.get('/api/projects/:name', (req, res) => {
    const name = req.params.name;
    const project = projects.find(project => project.name.toLowerCase() === name.toLowerCase());
    if (project) {
        res.send(project);
    } else {
        res.status(404).send('Not found');
    }
});

// Serves data about the latest version of a specific project by name via Spiget
app.get('/api/projects/:name/version', (req, res) => {
    const project = projects.find(project => project.name.toLowerCase() === req.params.name.toLowerCase());
    if (project) {
        let id = project.ids.spigot;
        if (id) {
            spiget.getLatestResourceVersion(id).then(resource => {
                res.send({
                    name: project.name,
                    version: resource.name,
                    date: resource.releaseDate
                });
            });
        } else {
            res.status(400).send('No Spigot ID for project');
        }
    } else {
        res.status(404).send('Not found');
    }
});


// Handle all other page requests
app.get('*', (req, res) => {
    let fullUrl = path.join(frontend, req.url);
    let urlModifiers = '';

    // If the file doesn't exist, serve the 404 page
    if (!fs.existsSync(fullUrl)) {
        if (!fs.existsSync(fullUrl + '.html')) {
            if (!fs.existsSync(fullUrl + '.md')) {
                sendError(res, '404');
                return;
            } else {
                urlModifiers = '.md';
            }
        } else {
            urlModifiers = '.html';
        }
    }

    // If the request is for a directory, serve the index.html file
    if (fs.lstatSync(fullUrl + urlModifiers).isDirectory()) {
        res.sendFile(path.join(req.url, 'index.html'), {root: frontend});
    }

    // If the request is for a file, serve it with the correct encoding
    else {
        // If the file is a .md file, parse it and serve it as HTML
        if (fullUrl.endsWith('.md') || urlModifiers === '.md') {
            res.send(formatTemplate(readme, {'PAGE_CONTENT': markdown.render(fs.readFileSync(path.join(frontend, req.url + urlModifiers), 'utf8'))}));
        } else {
            res.sendFile(req.url + urlModifiers, {root: frontend});
        }
    }
});


const sendError = (res, code, message) => {
    res.send(formatTemplate(error, {
        'ERROR_CODE': code,
        'ERROR_DESCRIPTION': message ? message : 'Make sure you entered the correct URL.'
    }));
}


// Formats markdown content
const formatMarkdown = (text, template) => {
    return formatTemplate(template, {'CONTENT': markdown.render(text)});
}


// Updates plugin documentation
const updateDocs = (repository, name) => {
    let wiki = repository + '.wiki.git';
    const filePath = path.join(frontend, `docs/${name.toLowerCase()}`);
    git(wiki, filePath, function (err) {
        if (err) {
            console.error('An error occurred pulling ' + wiki + ' to ' + filePath)
            console.error(err);
            return;
        }
        console.log('Updated project documentation for ' + name);
    });
}


// Format a template with a map of paired keys and values
const formatTemplate = (template, map) => {
    let formatted = template;
    for (const key in map) {
        if (map.hasOwnProperty(key)) {
            let occurrences = (formatted.match(new RegExp(`{{\\s*${key}\\s*}}`, 'g')) || []).length;
            for (let i = 0; i < occurrences; i++) {
                formatted = formatted.replace(`{{${key}}}`, map[key]);
            }
        }
    }
    return formatted;
}


// Update all project documentation
console.log('Updating project documentation...');
projects.filter(project => project.documentation).forEach(project => {
    updateDocs(project.repository, project.name);
});

// Serve the web application
app.use(express.static(frontend));
app.listen(port, host, () => {
    console.log(`Server running at on ${host}:${port}`);
    console.log('[Pterodactyl] Ready');
});