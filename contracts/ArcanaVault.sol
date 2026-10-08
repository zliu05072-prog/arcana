// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArcanaToken {
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function buyArca(uint256 minimumArca) external payable;
}

/// @notice Sepolia prototype escrow for the server-authoritative Arcana game.
/// Existing ARCA is deposited with token.transfer(vault, amount), without approval.
/// Gameplay is off-chain. A trusted service authorizes only reserved withdrawals.
/// The operator cannot withdraw escrow or change the signer/token after deployment.
contract ArcanaVault {
    IArcanaToken public token;
    address public authorizer;
    address public operator;
    mapping(bytes32 => bool) public used;
    bytes32 private constant CLAIM_TYPEHASH = keccak256("Claim(address wallet,uint256 amount,bytes32 nonce,uint256 deadline)");
    event EthDeposited(address indexed wallet, uint256 amount);
    event ReserveFunded(address indexed funder, uint256 amount);
    event Withdrawn(address indexed wallet, bytes32 indexed nonce, uint256 amount);

    constructor(address token_, address authorizer_) payable {
        require(block.chainid == 11155111 || block.chainid == 1337 || block.chainid == 31337, "Sepolia only");
        require(token_.code.length != 0 && authorizer_ != address(0), "Invalid configuration");
        token = IArcanaToken(token_);
        authorizer = authorizer_;
        operator = msg.sender;
        if (msg.value != 0) emit ReserveFunded(msg.sender, _purchase(msg.value));
    }

    function _purchase(uint256 value) private returns (uint256 amount) {
        uint256 beforeBalance = token.balanceOf(address(this));
        token.buyArca{value: value}(value * 100000);
        amount = token.balanceOf(address(this)) - beforeBalance;
        require(amount > 0, "No ARCA received");
    }

    /// @notice One transaction buys ARCA directly into the player's game escrow.
    function depositEth() external payable {
        emit EthDeposited(msg.sender, _purchase(msg.value));
    }

    /// @notice Explicit donation to fund rare-flower buybacks, not player credit.
    function fundReserve() external payable {
        emit ReserveFunded(msg.sender, _purchase(msg.value));
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("ArcanaVault"), keccak256("1"), block.chainid, address(this)
        ));
    }

    /// @notice Only the named wallet can redeem its single-use, expiring voucher.
    function withdraw(uint256 amount, bytes32 nonce, uint256 deadline, bytes calldata signature) external {
        require(amount > 0 && block.timestamp <= deadline, "Invalid or expired claim");
        require(!used[nonce] && signature.length == 65, "Used nonce or invalid signature");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(signature.offset) s := calldataload(add(signature.offset, 32)) v := byte(0, calldataload(add(signature.offset, 64))) }
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0 && (v == 27 || v == 28), "Invalid signature");
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce, deadline))));
        require(ecrecover(digest, v, r, s) == authorizer, "Unauthorized claim");
        used[nonce] = true;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, nonce, amount);
    }
}
