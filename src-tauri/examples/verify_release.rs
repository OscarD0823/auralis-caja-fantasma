use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::{env, error::Error, fs};

fn decode_wrapper(path: &str) -> Result<String, Box<dyn Error>> {
    let encoded = fs::read_to_string(path)?;
    if encoded.starts_with("untrusted comment:") {
        return Ok(encoded);
    }
    Ok(String::from_utf8(STANDARD.decode(encoded.trim())?)?)
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        return Err("Uso: verify_release PUBLIC_KEY FILE SIGNATURE".into());
    }
    let public_key = PublicKey::decode(&decode_wrapper(&args[1])?)?;
    let signature = Signature::decode(&decode_wrapper(&args[3])?)?;
    public_key.verify(&fs::read(&args[2])?, &signature, false)?;
    println!("Firma del instalador verificada con la clave publica esperada.");
    Ok(())
}
