const fs = require("fs").promises;

async function getAllArticles() {
    const method = "GET"
    const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer eeopdozi7klcck19lrbrje410uagtvk9z2dlr35x'
    }
    const apiUrl = 'https://api.helpdocs.io/v1/article?include_body=true&status=published'
    const response = await fetch(apiUrl, { method, headers })
    const data = await response.json()
    return data.articles
}

async function updateArticle(articleId, lang, { title, description, body }) {
    console.log('Updating: ', title)
    const payload = {
        multilingual: [{ language_code: lang, title, description, body, is_live: true }]
    }
    const string = JSON.stringify(payload)
    const method = "PATCH"
    const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer eeopdozi7klcck19lrbrje410uagtvk9z2dlr35x'
    }
    const apiUrl = `https://api.helpdocs.io/v1/article/${articleId}`
    const response = await fetch(apiUrl, { method, headers, body: string })
}

async function getTranslationFromCache(articleObj, lang) {
    const fileName = `${lang}-${articleObj.article_id}-${articleObj.updated_at}.txt`
    const path = `./translations/${fileName}`
    try {
        const json = await fs.readFile(path, 'utf8')
        return json.trim() == '' ? null : JSON.parse(json)
    } catch(e) {
        return null
    }
}

function saveTranslationToCache(articleObj, lang, data) {
    const fileName = `${lang}-${articleObj.article_id}-${articleObj.updated_at}.txt`
    const path = `./translations/${fileName}`
    return fs.writeFile(path,  JSON.stringify(data))
}

async function translateArticle(articleObj, lang) {
    const useCache = true
    let data = await getTranslationFromCache(articleObj, lang)
    if (!data) {
        const formData = new FormData()
        formData.append('text', articleObj.title)
        formData.append('text', articleObj.description)
        formData.append('text', articleObj.body)
        formData.append('target_lang', lang)
        formData.append('source_lang', 'en')
        formData.append('tag_handling', 'html')
        const method = "POST"
        const headers = {
            'authorization': 'DeepL-Auth-Key fcc83ca7-ffe5-f968-df3b-8fba298cfa8e'
        }
        const apiUrl = 'https://api.deepl.com/v2/translate'
        const response = await fetch(apiUrl, { method, headers, body: formData })
        if (response.status !== 200) {
            throw new Error(`DeepL API returned a status code ${response.status}`)
        }
        data = await response.json()
        await saveTranslationToCache(articleObj, lang, data)
    }
    const translations = data.translations
    const title = translations[0].text
    const description = translations[1].text
    const rawBody = translations[2].text
    const body = rawBody.replaceAll('href="/l/en/article', `href="/l/${lang}/article`)
    return { title, description, body }
}

async function processArticle(article, lang) {
    const translation = await translateArticle(article, lang)
    updateArticle(article.article_id, lang, translation)
}

function chunkArray(array, chunkSize) {
    const result = [];
  
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
  
    return result;
  }
  
function processChunk(chunk, lang) {
    return Promise.all(chunk.map(function(article) { processArticle(article, lang) }));
}

async function main() { 
    //const langs = ['hu', 'id', 'lv', 'lt', 'no', 'pl', 'pt'];
    //const langs = ['ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk']
    const langs = ['nb', 'pl', 'pt'];
    // const chunkSize = 1
    const articles = await getAllArticles()
    for (const lang of langs) {
        console.log('processing lang: ', lang)
        for (const article of articles) {
            console.log('processing article: ', article.article_id)
            const translation = await translateArticle(article, lang)
            updateArticle(article.article_id, lang, translation)
        }
    }
}

main()