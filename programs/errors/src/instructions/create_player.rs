use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use crate::state::player::*;

pub fn create_player(ctx: Context<CreatePlayer>) -> Result<()> {
    // Initialize the Player
    let new_player = &mut ctx.accounts.player_pda;
    new_player.init(ctx.accounts.player.key(), ctx.bumps.player_pda);

    // Airdrop 10 Game Tokens
    let signer_seeds: &[&[&[u8]]] = &[&[b"play_token_mint", &[ctx.bumps.mint]]];
    let airdrop_amount: u64 = 10;

    mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.player_token_account.to_account_info(),
                authority: ctx.accounts.mint.to_account_info(),
            },
        ).with_signer(signer_seeds), // using PDA to sign
        airdrop_amount,
    )?;
    new_player.airdrop_received = true;

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        init,
        payer = player, 
        space = Player::calculate_account_space(), 
        seeds = [b"player", player.key().as_ref()],
        bump
    )]
    pub player_pda: Account<'info, Player>,
    #[account(
        mut,
        seeds = [b"play_token_mint"], 
        bump
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = player,
        associated_token::mint = mint,
        associated_token::authority = player,
    )]
    pub player_token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
