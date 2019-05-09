const { config, proxy } = require('internal')
const needle = require('needle')
const cheerio = require('cheerio')

const defaults = {
	name: 'MP3 Clan',
	prefix: 'mp3clan_',
	host: 'http://mp3guild.com',
	icon: 'https://www.macupdate.com/images/icons256/52415.png'
}

const hostParts = config.host.match(/^[\w-]+:\/{2,}\[?[\w\.:-]+\]?(?::[0-9]*)?/i)

let host

if ((hostParts || []).length)
	host = hostParts[0]
else
	host = defaults.host

const { addonBuilder, getInterface, getRouter } = require('stremio-addon-sdk')

const builder = new addonBuilder({
	id: 'org.' + defaults.name.toLowerCase().replace(/[^a-z]+/g,''),
	version: '1.0.0',
	name: defaults.name,
	description: 'Search and play music from MP3 Clan / MP3 Guild websites',
	resources: ['stream', 'meta', 'catalog'],
	types: ['music', 'tv'],
	idPrefixes: [defaults.prefix],
	icon: defaults.icon.replace(defaults.host, host),
	catalogs: [
		{
			id: defaults.prefix + 'cat',
			name: 'MP3 Clan',
			type: 'music',
			extra: [{ name: 'search', isRequired: true }]
		}
	]
})

builder.defineCatalogHandler(args => {
	return new Promise((resolve, reject) => {
		const extra = args.extra || {}
        needle.post(host + '/mp3_source.php', 'ser='+encodeURIComponent(extra.search)+'&page=0', { headers: { referer: host + '/mp3/' + encodeURIComponent(extra.search) + '.html' } }, (err,resp,body) => {
            if (!err && body) {
            	const $ = cheerio.load(body)
                const results = []
                $('.mp3list-play').each(function(ij, el) {
                     let title = $(el).children('.unselectable').text()
                     title += ' (' + $(el).children('.mp3list-bitrate').text().trim().replace('Check ', '') + ')'
                     const href = $(el).children('a').attr('href')
                     results.push({
                        id: 'mp3clan_id:'+encodeURIComponent(href)+':mp3title:'+encodeURIComponent(title)+':mp3query:'+encodeURIComponent(extra.search),
                        name: title,
                        type: 'tv',
                        posterShape: 'landscape'
                     })
                })
                resolve({ metas: results })
            }
        })
	})
})

builder.defineMetaHandler(args => {
	return new Promise((resolve, reject) => {
        const parts = args.id.replace(defaults.prefix, '').split(':mp3title:')
        resolve({ meta: { id: args.id, name: decodeURIComponent(parts[1].split(':mp3query:')[0]), type: 'tv' } })
	})
})

builder.defineStreamHandler(args => {
	return new Promise((resolve, reject) => {
        const parts = args.id.replace('mp3clan_id:', '').split(':mp3title:')
        const query = parts[1].split(':mp3query:')[1]
        const referer = host + '/mp3/' + query + '.html'
        needle.get(proxy.addProxy(decodeURIComponent(parts[0]),{ headers: { referer }}), { headers: { cookie: 'genre=1; tara=US; download=approved' } }, (err, resp, body) => {
            if (resp && resp.headers && resp.headers.location) {
                const url = resp.headers.location
                resolve({ streams: [ { url: proxy.addProxy(url, { headers: { referer } }), title: decodeURIComponent(parts[1].split(':mp3query:')[0]) } ] })
            } else
            	reject(defaults.name + ' - Could not get stream for: ' + args.id)
        })
	})
})

const addonInterface = getInterface(builder)

module.exports = getRouter(addonInterface)
