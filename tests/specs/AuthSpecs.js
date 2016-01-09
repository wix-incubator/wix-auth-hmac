var expect = require('expect.js');
var WixAuth = require('../../src/WixAuth');

describe('Test Wix Media Services', function () {
	it('Test URL Options', function () {
		var r = new WixAuth.HMACAuthRequest("http://test.com", "GET", "/api/v1/test", "123456789");
		var options = r.asHeaders("x-test-")
			.withHeader("x-test-1", "1")
			.withHeader("x-test-2", "2")
			.withHeader("x-test-3", "3")
			.toHttpsOptions("signature");

		expect(options.headers).to.have.property("x-test-1");
		expect(options.headers).to.have.property("x-test-2");
		expect(options.headers).to.have.property("x-test-3");
		expect(options.headers).to.have.property("signature");
		expect(options.headers.signature).to.be("aSt651CHcZHEJx8iZkJcIGp6hCu_Mh0Rd_08NfqQ3Q4");
	});

	it('Test URL Options, with values', function () {
		var r = new WixAuth.HMACAuthRequest("http://test.com", "GET", "/api/v1/test", "123456789");
		var options = r.asHeaders("x-test-")
			.options(WixAuth.Options.WITH_PARAM_VALUES, true)
			.withHeader("x-test-1", "1")
			.withHeader("x-test-2", "2")
			.withHeader("x-test-3", "3")
			.toHttpsOptions("signature");

		expect(options.headers).to.have.property("x-test-1");
		expect(options.headers).to.have.property("x-test-2");
		expect(options.headers).to.have.property("x-test-3");
		expect(options.headers).to.have.property("signature");
		expect(options.headers.signature).to.be("HBfQJRskh8J4PZDopdGaGbBcRz5Vs8nM28k_PMLsPC4");
	});

	it('Test URL Options, with values', function () {
		var r = new WixAuth.HMACAuthRequest("http://test.com", "GET", "/api/v1/test", "123456789");
		var options = r.asHeaders("x-test-")
			.options(WixAuth.Options.WEBSAFE_B64, false)
            .options(WixAuth.Options.PAD_B64, true)
			.withHeader("x-test-1", "1")
			.withHeader("x-test-2", "2")
			.withHeader("x-test-3", "3")
			.toHttpsOptions("signature");

		expect(options.headers).to.have.property("x-test-1");
		expect(options.headers).to.have.property("x-test-2");
		expect(options.headers).to.have.property("x-test-3");
		expect(options.headers).to.have.property("signature");
		expect(options.headers.signature).to.be("aSt651CHcZHEJx8iZkJcIGp6hCu/Mh0Rd/08NfqQ3Q4=");
	});

	it('Test URL Options, with values', function () {
		var r = new WixAuth.HMACAuthRequest("http://test.com", "GET", "/api/v1/test", "123456789");
		var options = r.asHeaders("x-test-")
			.options(WixAuth.Options.WITH_PARAM_VALUES, true)
			.options(WixAuth.Options.WEBSAFE_B64, false)
            .options(WixAuth.Options.PAD_B64, true)
			.withHeader("x-test-1", "1")
			.withHeader("x-test-2", "2")
			.withHeader("x-test-3", "3")
			.toHttpsOptions("signature");

		expect(options.headers).to.have.property("x-test-1");
		expect(options.headers).to.have.property("x-test-2");
		expect(options.headers).to.have.property("x-test-3");
		expect(options.headers).to.have.property("signature");
		expect(options.headers.signature).to.be("HBfQJRskh8J4PZDopdGaGbBcRz5Vs8nM28k/PMLsPC4=");
	});
});

