/**
 * @file core library for connecting to Wix REST APIs
 * @author David Zuckerman <davidz@wix.com>
 * */

var crypto = require('crypto');
var urlLib = require('url');
var _ = require('lodash-node');

function signData(mode, key, data, sanitize) {
	var hmac = crypto.createHmac(mode.value(), key);
	return sanitize ? toBase64Safe(hmac.update(data).digest('base64')) : hmac.update(data).digest('base64');
}

function toBase64Safe(out, encoding) {
	if (out instanceof Buffer) {
		return toBase64Safe(out.toString((encoding !== undefined ? encoding : 'base64')));
	}
	return out.replace(/\+/g, '-').replace(/\//g, '_');
}

function removeBase64Padding(b64) {
	return b64.replace('=', '')
}

function WixPaths() {
	this.paths = [];
}

WixPaths.prototype = {
	withSegment: function (segment) {
		if (segment && segment !== null && segment.length > 0) {
			this.paths.push(segment);
		}
		return this;
	},
	toString: function () {
		return this.paths.join('/');
	}
};

function WixParameters(copy) {
	if (copy !== undefined && copy instanceof WixParameters) {
		this.params = copy.params.slice(0)
	} else {
		this.params = [];
	}
}

WixParameters.prototype = {
	withParameter: function (name, value) {
		var normalizedValue;
		if (Array.isArray(value)) {
			normalizedValue = value.join(',');
		} else if ('string' === typeof value) {
			normalizedValue = value.trim();
		} else {
			normalizedValue = value;
		}
		this.params.push({param: name, value: normalizedValue});
		return this;
	},
	getParameters: function () {
		return this.params;
	},
	withParameters: function (params) {
		this.params = this.params.concat(params);
		return this;
	},
	hasParameters : function() {
		return this.params.length > 0;
	},
	toQueryString: function () {
		return _.reduce(this.params, function (queryOut, element) {
			return queryOut + ((queryOut.length > 0) ? '&' : '') + element.param + '=' + element.value;
		}, '');
	},
	toHeaderMap: function () {
		if (this.params.length === 0) {
			return null;
		}
		var r = {};
		for (var i = 0; i < this.params.length; i++) {
			r[this.params[i].param] = this.params[i].value;
		}
		return r;
	}
};

function Scheme(m) {
	this.value = function() {
		return m;
	}
}

var Algorithms = {
	"SHA256" : new Scheme("sha256"),
	"SHA1" : new Scheme("sha1")
};

var Options = {
	WITH_PARAM_VALUES : "withParameterValues",
	PATH_PRIORITY : "pathPriority",
	HMAC_SCHEMA : "hmacSchema",
	WEBSAFE_B64 : "websafeBase64",
	PAD_B64 : "padB64",
	TRAILING_NEWLINE : "trailingNewline"
}

function initFromOptions(options, param, defaultValue) {
	return (options !== undefined && options[param] !== undefined) ? options[param] : defaultValue;
}

function HMACAuthRequest(url, verb, path, secretKey, options) {
	this.paths = new WixPaths();
	this.headers = new WixParameters();
	this.queryParams = new WixParameters();
	this.key = secretKey;
	this.verb = verb;
	this.path = path;
	this.postData = null;
	this.url = url;
	this.options(Options.WITH_PARAM_VALUES, initFromOptions(options, Options.WITH_PARAM_VALUES, false));
	this.options(Options.PATH_PRIORITY, initFromOptions(options, Options.PATH_PRIORITY, true));
	this.options(Options.HMAC_SCHEMA, initFromOptions(options, Options.HMAC_SCHEMA, Algorithms.SHA256));
	this.options(Options.WEBSAFE_B64, initFromOptions(options, Options.WEBSAFE_B64, true));
	this.options(Options.TRAILING_NEWLINE, initFromOptions(options, Options.TRAILING_NEWLINE, false));
	this.options(Options.PAD_B64, initFromOptions(options, Options.PAD_B64, false));

}

HMACAuthRequest.prototype = {
	options : function(key, value) {
		if(key === Options.HMAC_SCHEMA) {
			if(!(value instanceof Scheme)) {
				throw "Bad HMAC scheme";
			}
			this.cryptMode = value;
		} else if(key === Options.WITH_PARAM_VALUES) {
			this.withValues = value;
		} else if(key === Options.PATH_PRIORITY) {
			this.pathFirst = value;
		} else if(key === Options.WEBSAFE_B64) {
			this.sanitizeB64 = value;
		}  else if(key === Options.TRAILING_NEWLINE) {
			this.trailingNewline = value;
		} else if(key === Options.PAD_B64) {
			this.padB64Output = value;
		}
		return this;
	},
	withPostData: function (data) {
		this.postData = data;
		return this;
	},
	asHeaders: function (headerPrefix) {
		this.paramMode = 'header';
		this.headerPrefix = headerPrefix;
		return this;
	},
	asQueryParams: function () {
		this.paramMode = 'query';
	},
	isHeaderMode: function () {
		return this.paramMode === 'header';
	},
	isQueryMode: function () {
		return this.paramMode === 'query';
	},
	withPathSegment: function (segment) {
		this.paths.withSegment(segment);
		return this;
	},
	withQueryParam: function (key, value) {
		this.queryParams.withParameter(key, value);
		return this;
	},
	withHeader: function(key, value) {
		this.headers.withParameter(key, value);
		return this;
	},
	getHeaders: function () {
		var signingHeaders = new WixParameters(this.headers);
		var standardHeaders = new WixParameters(this.headers);
		if (this.isHeaderMode()) {
			var that = this;
			_.remove(signingHeaders.params, function(p) {
				if(p.param.length > that.headerPrefix.length) {
					return p.param.substring(0, that.headerPrefix.length) !== that.headerPrefix;
				}
				return false;
			});
		}
		if (this.postData !== undefined && this.postData !== null) {
			standardHeaders.withParameter('Content-Length', JSON.stringify(this.postData).length).
				withParameter('Content-Type', 'application/json');
		}

		return {signing: signingHeaders, all: standardHeaders};
	},
	getQueryParams: function () {
		return this.queryParams;
	},
	calculateSignature: function () {
		var headers = this.getHeaders().signing.getParameters();
		var parameters = this.getQueryParams().params.concat(headers);
		parameters.sort(function (a, b) {
			if (a.param < b.param) return -1;
			if (a.param > b.param) return 1;
			return 0;
		});
		var pathString = urlLib.parse(this.path + this.paths.toString()).pathname;
		var out = this.verb + "\n";
		if(this.pathFirst) {
			out += pathString + "\n"
		}
		if(this.withValues) {
			out += _.reduce(parameters, function(result, value) {
				result.push(value.param + ":" + value.value);
				return result;
			}, []).join('\n');
		} else {
			out += _.pluck(parameters, 'value').join('\n');
		}
		if (this.postData) {
			out += "\n" + this.postData;
		}
		if(!this.pathFirst) {
			out += "\n" + pathString
		}
		if(this.trailingNewline) {
			out += "\n";
		}
		var sig = signData(this.cryptMode, this.key, out, this.sanitizeB64);
		if(!this.padB64Output) {
			sig = removeBase64Padding(sig);
		}
		return sig;
	},
	toRequestAuth : function(signature) {
		return signature;
	},
	toHttpsOptions: function (signatureKey) {
		var sig = this.calculateSignature();
		var headers = this.getHeaders();
		var query = this.getQueryParams();
		var needsAuth = query;
		if (this.isHeaderMode()) {
			needsAuth = headers.all;
		}
		needsAuth.withParameter(signatureKey, this.toRequestAuth(sig));
		var path = this.path + this.paths.toString();
		if(query.hasParameters()) {
			path += '?' + query.toQueryString();
		}
		return {
			host: this.url,
			path: path,
			method: this.verb,
			headers: headers.all.toHeaderMap()
		};
	}
};

module.exports = {
	HMACAuthRequest : HMACAuthRequest,
	Utils : {
		toWebSafeB64 : toBase64Safe,
		signData : signData
	},
	Algorithms : Algorithms,
	Options : Options
};
