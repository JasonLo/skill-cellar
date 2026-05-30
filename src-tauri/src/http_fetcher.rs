//! The live registry fetcher: a blocking HTTP GET of the curated manifest.
//! This is the only network code in the app, and it is confined to the shell
//! (the core stays network-free). A failure surfaces as `AppError::Network`,
//! which `core::get_registry` turns into the cache/bundled fallback.

use skill_cellar_core::{AppError, AppResult, RegistryFetcher, RegistryManifest};

pub struct HttpFetcher {
    client: reqwest::blocking::Client,
    url: String,
}

impl HttpFetcher {
    pub fn new(url: impl Into<String>) -> Self {
        let client = reqwest::blocking::Client::builder()
            .user_agent(concat!("skill-cellar/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("failed to build HTTP client");
        HttpFetcher {
            client,
            url: url.into(),
        }
    }
}

impl RegistryFetcher for HttpFetcher {
    fn fetch_manifest(&self) -> AppResult<RegistryManifest> {
        let resp = self
            .client
            .get(&self.url)
            .send()
            .map_err(|e| AppError::Network(e.to_string()))?
            .error_for_status()
            .map_err(|e| AppError::Network(e.to_string()))?;
        resp.json::<RegistryManifest>()
            .map_err(|e| AppError::Network(e.to_string()))
    }
}
