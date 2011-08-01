var express = require('express')
	, nowjs = require('now')
	, server = express.createServer();

// initialising express
server.get('*', function(req, res) { res.render('door.ejs', {layout:false}); });
// initialising nowjs
var clients = [], everyone = nowjs.initialize(server);

// helper
Number.between = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 
var boardWidth = 1024, boardHeight = 800, boardMargin = 30;
var rgb = [ Number.between(80, 130)
			, Number.between(80, 130)
			, Number.between(80, 130)];

// new color, not far from previous one.
rgb.refresh = function () {
	this.forEach(function (v, i) {
		var k = Number.between(-5, 10);
		rgb[i] = (v + k <= 255 && v + k >= 0) ? v + k : v;
	});
	return this.concat(); // cloning the array.
};

// generating magnets based on alphabet.
var magnetsById = {}, magnets =
"AAAABBCCDDEEEEFFGGHHIIIJJKKLLMMNNOOOPPQQRRSSTTUUUVVWXYZ☺⬅⬆⬇⬈⬉⬊⬋⬌⬍'|-_"
	.split('')
	.map(function (magnet, i) {
		return { 'id' : 'm'+i																// id
			, 'data' : magnet																	// data
			, 'angle' : Number.between(-10, 10)											// angle
			, 'top' : Number.between(boardMargin, boardHeight-boardMargin)		// top
			, 'left' : Number.between(boardMargin, boardWidth-boardMargin)		// left
			, 'color' : rgb.refresh()														// color
			, 'owner' : null																	// clientId, used for semaphore
		}
	});
magnets.forEach(function (m) { magnetsById[m.id] = m; });

// browser is requesting magnets
everyone.now.requestMagnets = function () {
	console.log('client '+this.user.clientId+' requestMagnets()');
	// sending magnets descriptor to the browser
	this.now.updateMagnets(magnets.map(function (o) {
		// minify
		return { 'i' : o.id
			, 'd' : o.data
			, 'a' : o.angle
			, 't' : o.top
			, 'l' : o.left
			, 'c' : o.color
		};
	})); // to a single user.
};

// browser is moving a magnet
everyone.now.moveMagnet = function (magnetId, top, left) {
	console.log('<= client '+this.user.clientId+' moveMagnet('+magnetId+', '+top+', '+left+')');
	magnetsById[magnetId].top = top;
	magnetsById[magnetId].left = left; 
	everyone.now.updateMagnet(magnetId, top, left);
};

// semaphore: acquireMagnet/releaseMagnet prevent several users 
//  from moving the same magnet at a time
everyone.now.acquireMagnet = function (magnetId) {
	console.log('<= client '+this.user.clientId+' acquireMagnet('+magnetId+')');
	// a client can only acquire 1 magnet at time.
	var userNow = this.now;
	var userId = this.user.clientId;
	var userMagnet = magnets.filter(function (m) { 
		return m.owner == userId;
	}).forEach(function (m) {
		// reseting owner
		m.owner = null;
		// sending order to disable drag&drop on magnet
		userNow.magnetLost(m.id);
	});
	// acquiring magnet
	if (magnetsById[magnetId].owner == null)
	{
		// sending order to enable drag&drop on magnet
		magnetsById[magnetId].owner = userId;
		userNow.magnetAcquired(magnetId);
	}
};

// managing clients.
nowjs.on('connect', function () { clients.push(this.user.clientId); });
nowjs.on('disconnect', function () { delete clients[this.user.clientId]; });

server.listen(80);