use serde::{Deserialize, Deserializer, Serialize, Serializer};
use thiserror::Error;
use url::Url;

const ALLOWED_HOSTS: &[&str] = &[
    "drive.google.com",
    "docs.google.com",
    "www.youtube-nocookie.com",
    "youtu.be",
    "player.vimeo.com",
];

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UrlError {
    #[error("URL inválida")]
    Parse(String),
    #[error("solo se permite https")]
    Scheme,
    #[error("no se permiten credenciales en la URL")]
    Credentials,
    #[error("no se permiten puertos personalizados")]
    Port,
    #[error("host no permitido: {0}")]
    Host(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResourceUrl(Url);

impl ResourceUrl {
    pub fn parse(raw: &str) -> Result<Self, UrlError> {
        let url = Url::parse(raw.trim()).map_err(|error| UrlError::Parse(error.to_string()))?;
        if url.scheme() != "https" {
            return Err(UrlError::Scheme);
        }
        if url.username() != "" || url.password().is_some() {
            return Err(UrlError::Credentials);
        }
        if url.port().is_some() {
            return Err(UrlError::Port);
        }
        let host = url.host_str().unwrap_or_default().to_owned();
        let allowed = ALLOWED_HOSTS.iter().any(|candidate| host == *candidate);
        if !allowed {
            return Err(UrlError::Host(host));
        }
        Ok(Self(url))
    }

    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }

    pub fn host(&self) -> Option<&str> {
        self.0.host_str()
    }
}

impl TryFrom<String> for ResourceUrl {
    type Error = UrlError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(&value)
    }
}

impl From<ResourceUrl> for String {
    fn from(value: ResourceUrl) -> Self {
        value.0.into()
    }
}

impl Serialize for ResourceUrl {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for ResourceUrl {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        Self::parse(&raw).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::{ResourceUrl, UrlError};

    #[test]
    fn accepts_allowed_resource_hosts() {
        for value in [
            "https://drive.google.com/file/d/example/view",
            "https://docs.google.com/document/d/example/edit",
            "https://www.youtube-nocookie.com/embed/example",
            "https://youtu.be/example",
            "https://player.vimeo.com/video/123",
        ] {
            assert!(ResourceUrl::parse(value).is_ok(), "{value}");
        }
    }

    #[test]
    fn rejects_unsafe_schemes_and_hosts() {
        assert_eq!(
            ResourceUrl::parse("javascript:alert(1)"),
            Err(UrlError::Scheme)
        );
        assert_eq!(
            ResourceUrl::parse("https://example.com/file"),
            Err(UrlError::Host("example.com".to_owned()))
        );
        assert_eq!(
            ResourceUrl::parse("https://user:pass@drive.google.com/file"),
            Err(UrlError::Credentials)
        );
    }
}
