import styled, {css} from 'styled-components';

//pure css names are used here. not javascript style names like react native
//eg. background-color instead of backgroundColor
const EasyButton = styled.TouchableOpacity`
    flex-direction: row;
    border-radius: 3px;
    padding: 10px;
    margin: 5px;
    background: transparent;
    justify-content: center;

    ${props => props.primary && css`
        background: #5cb85c;
    `}

    ${props => props.secondary && css`
        background: #0275d8;
    `}

    ${props => props.tertiary && css`
        background: #cda410ff;
    `}

    ${props => props.danger && css`
        background: #d9534f;
    `}
    
    ${props => props.contained && css`
        mode: contained;
    `}

    ${props => props.large && css`
        width: 135px;
    `}

    ${props => props.medium && css`
        width: 100px;
    `}

    ${props => props.small && css`
        width: 40px;
    `}
`;

export default EasyButton;

