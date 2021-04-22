const baseManifest = {
	"background_color": "#ffffff",
	"theme_color": "#333333",
	"name": "Synching list",
	"short_name": "List",
	"display": "minimal-ui",
	"start_url": "/",
	"icons": [
		{
			"src": "logo-192.png",
			"sizes": "192x192",
			"type": "image/png"
		},
		{
			"src": "logo-512.png",
			"sizes": "512x512",
			"type": "image/png"
		}
	]
}

export function manifest(request, response) {
  console.log("req:", request.headers)

  response.writeHead(200, '', {
    'Content-Type': 'application/json'
  })
  response.write(JSON.stringify(baseManifest))
  response.send()
}