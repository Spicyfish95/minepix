use std::{env, fs};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.len() != 3 {
        return Err("render <input> <size> <output rgba>".into());
    }
    let image = minepix_thumbnailer::thumbnail(&fs::read(&args[0])?, args[1].parse()?)?;
    fs::write(&args[2], &image.rgba)?;
    println!(
        "{}",
        serde_json::json!({"width":image.width,"height":image.height,"bytes":image.rgba.len()})
    );
    Ok(())
}
